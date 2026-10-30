"""Admin HTTP permissions, real SQL persistence, CSRF, media, conflicts and audit history."""

import asyncio
import io
import os
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import select

from app.api.routes import admin
from app.core.config import settings
from app.core.dependencies import get_db
from app.core.redis import get_redis
from app.core.security import hash_password
from app.main import app
from app.models.admin import AdminSession, RestaurantAudit
from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.admin import RestaurantEdit
from app.services.restaurant_media import prepare_photo
from tests.admin_support import test_database

ORIGIN = "http://testserver"
PASSWORD = "test-only-long-password"


def image_bytes():
    out = io.BytesIO()
    image = Image.new("RGB", (200, 100), "red")
    image.save(out, "JPEG", exif=Image.Exif())
    return out.getvalue()


class MemoryMedia:
    def __init__(self):
        self.objects = {}

    def put(self, key, image):
        self.objects[key] = image

    def get(self, key):
        return self.objects[key]

    def delete(self, key):
        self.objects.pop(key, None)


@pytest_asyncio.fixture
async def context(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_ENABLED", True)
    monkeypatch.setattr(settings, "PUBLIC_BASE_URL", ORIGIN)
    monkeypatch.setattr(settings, "RESTAURANT_PHOTO_BUCKET", "test-only-ginder-photos")
    engine, factory = await test_database()
    async with factory() as db:
        owner = User(
            email="admin@example.com",
            display_name="Admin",
            is_admin=True,
            hashed_password=hash_password(PASSWORD),
        )
        member = User(
            email="member@example.com",
            display_name="Member",
            is_admin=False,
            hashed_password=hash_password(PASSWORD),
        )
        restaurant = Restaurant(
            place_id="osm:node/123",
            source="osm",
            source_place_id="node/123",
            name="ร้านทดสอบ",
            primary_category="Other",
            latitude=14.07,
            longitude=100.60,
        )
        db.add_all([owner, member, restaurant])
        await db.commit()
        ids = SimpleNamespace(owner=owner.id, member=member.id, restaurant=restaurant.id)

    async def session_override():
        async with factory() as db:
            try:
                yield db
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    old_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = session_override
    app.dependency_overrides[get_redis] = lambda: SimpleNamespace(eval=AsyncMock(return_value=1))
    media = MemoryMedia()
    monkeypatch.setattr(admin, "RestaurantMedia", lambda: media)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url=ORIGIN,
    ) as client:
        try:
            yield SimpleNamespace(client=client, db=factory, ids=ids, media=media)
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(old_overrides)
            await engine.dispose()


async def sign_in(ctx, email="admin@example.com"):
    response = await ctx.client.post(
        "/admin/api/login",
        headers={"Origin": ORIGIN},
        json={
            "email": email,
            "password": PASSWORD,
        },
    )
    assert response.status_code == 200, response.text
    return {"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}


def edit_body(version=1):
    return {
        "expected_version": version,
        "name": "ร้านทดสอบ สาขามหาวิทยาลัย",
        "primary_category": "Thai",
        "latitude": 14.071,
        "longitude": 100.601,
        "address": None,
        "price_level": None,
        "opening_hours": None,
        "admin_notes": "ตรวจพิกัดหน้าร้านแล้ว",
        "reviewed": True,
    }


@pytest.mark.asyncio
async def test_disabled_admin_is_closed_even_for_static_assets(context, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_ENABLED", False)
    for path in ["/admin", "/admin/assets/admin.js", "/admin/api/session"]:
        assert (await context.client.get(path)).status_code == 404


@pytest.mark.asyncio
async def test_regular_member_cannot_sign_in_to_admin(context):
    response = await context.client.post(
        "/admin/api/login",
        headers={"Origin": ORIGIN},
        json={
            "email": "member@example.com",
            "password": PASSWORD,
        },
    )
    assert response.status_code == 401
    assert "ginder_admin" not in context.client.cookies
    assert (await context.client.get("/admin/api/restaurants")).status_code == 401


@pytest.mark.asyncio
async def test_cookie_session_logout_and_database_revocation(context):
    headers = await sign_in(context)
    response = await context.client.get("/admin/api/session")
    assert response.status_code == 200
    assert "no-store" in response.headers["cache-control"]
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    async with context.db() as db:
        owner = await db.get(User, context.ids.owner)
        owner.is_admin = False
        await db.commit()
    assert (await context.client.get("/admin/api/restaurants")).status_code == 403
    async with context.db() as db:
        owner = await db.get(User, context.ids.owner)
        owner.is_admin = True
        await db.commit()
    response = await context.client.post("/admin/api/logout", headers=headers)
    assert response.status_code == 204
    assert (await context.client.get("/admin/api/session")).status_code == 401


@pytest.mark.asyncio
async def test_login_cookie_is_httponly_and_limited_to_admin(context):
    response = await context.client.post(
        "/admin/api/login",
        headers={"Origin": ORIGIN},
        json={
            "email": "admin@example.com",
            "password": PASSWORD,
        },
    )
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "path=/admin" in cookie and "samesite=strict" in cookie


@pytest.mark.asyncio
@pytest.mark.parametrize("headers", [{}, {"Origin": "https://evil.example"}, {"Origin": ORIGIN}])
async def test_mutations_require_matching_origin_and_csrf(context, headers):
    await sign_in(context)
    response = await context.client.patch(
        f"/admin/api/restaurants/{context.ids.restaurant}", headers=headers, json=edit_body()
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_save_preserves_identity_audits_changes_and_rejects_stale_tab(context):
    headers = await sign_in(context)
    path = f"/admin/api/restaurants/{context.ids.restaurant}"
    response = await context.client.patch(path, headers=headers, json=edit_body())
    assert response.status_code == 200, response.text
    assert response.json()["version"] == 2
    assert response.json()["place_id"] == "osm:node/123"
    assert response.json()["price_level"] is None
    assert (await context.client.patch(path, headers=headers, json=edit_body())).status_code == 409
    detail = (await context.client.get(path)).json()
    assert detail["history"][0]["changes"]["name"]["before"] == "ร้านทดสอบ"
    async with context.db() as db:
        row = await db.get(Restaurant, context.ids.restaurant)
        assert row.is_permanent and row.expires_at is None


@pytest.mark.asyncio
async def test_list_search_duplicates_and_quality_counts(context):
    await sign_in(context)
    async with context.db() as db:
        db.add(
            Restaurant(
                place_id="osm:node/456",
                source="osm",
                source_place_id="node/456",
                name="ร้านทดสอบ",
                primary_category="Other",
                latitude=14.08,
                longitude=100.61,
            )
        )
        await db.commit()
    response = await context.client.get("/admin/api/restaurants?issue=duplicates")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 2 and data["stats"]["missing_photo"] == 2
    assert data["stats"]["missing_hours"] == 2
    assert (await context.client.get("/admin/api/restaurants?q=no-such-name")).json()["total"] == 0


@pytest.mark.asyncio
async def test_upload_replacement_public_image_and_removal(context):
    headers = await sign_in(context)
    path = f"/admin/api/restaurants/{context.ids.restaurant}/photo"

    async def upload(version):
        return await context.client.post(
            path,
            headers=headers,
            files={
                "file": ("shop.jpg", image_bytes(), "image/jpeg"),
            },
            data={
                "expected_version": str(version),
                "attribution": "Test Photographer",
                "source": "owner_upload",
                "rights_confirmed": "true",
            },
        )

    first = await upload(1)
    assert first.status_code == 200, first.text
    old_url = first.json()["photo_url"]
    assert (await context.client.get(old_url)).headers["content-type"] == "image/webp"
    second = await upload(2)
    assert second.status_code == 200
    assert second.json()["photo_url"] != old_url
    assert len(context.media.objects) == 1
    assert (await context.client.get(old_url)).status_code == 404
    removed = await context.client.request(
        "DELETE", path, headers=headers, json={"expected_version": 3}
    )
    assert removed.status_code == 200 and removed.json()["photo_url"] is None
    assert not context.media.objects
    async with context.db() as db:
        audits = (await db.scalars(select(RestaurantAudit))).all()
        assert len(audits) == 3


@pytest.mark.asyncio
async def test_invalid_upload_and_missing_permission_do_not_write_s3(context):
    headers = await sign_in(context)
    path = f"/admin/api/restaurants/{context.ids.restaurant}/photo"
    for content, rights in [(b"not an image", "true"), (image_bytes(), "false")]:
        response = await context.client.post(
            path,
            headers=headers,
            files={"file": ("x.jpg", content, "image/jpeg")},
            data={
                "expected_version": "1",
                "attribution": "Owner",
                "source": "owner_upload",
                "rights_confirmed": rights,
            },
        )
        assert response.status_code == 422
    assert not context.media.objects


@pytest.mark.asyncio
async def test_storage_failure_does_not_change_restaurant(context, monkeypatch):
    headers = await sign_in(context)

    def fail(*_args):
        raise OSError("storage unavailable")

    monkeypatch.setattr(context.media, "put", fail)
    response = await context.client.post(
        f"/admin/api/restaurants/{context.ids.restaurant}/photo",
        headers=headers,
        files={"file": ("x.jpg", image_bytes(), "image/jpeg")},
        data={
            "expected_version": "1",
            "attribution": "Owner",
            "source": "owner_upload",
            "rights_confirmed": "true",
        },
    )
    assert response.status_code == 503
    async with context.db() as db:
        row = await db.get(Restaurant, context.ids.restaurant)
        assert row.photo_url is None and row.admin_version == 1


@pytest.mark.asyncio
async def test_database_failure_removes_new_photo_and_preserves_old_record(context, monkeypatch):
    from sqlalchemy.ext.asyncio import AsyncSession

    headers = await sign_in(context)
    original_commit = AsyncSession.commit

    async def fail_photo_commit(db):
        if any(isinstance(obj, RestaurantAudit) for obj in db.new):
            raise RuntimeError("simulated database failure")
        await original_commit(db)

    monkeypatch.setattr(AsyncSession, "commit", fail_photo_commit)
    response = await context.client.post(
        f"/admin/api/restaurants/{context.ids.restaurant}/photo",
        headers=headers,
        files={"file": ("x.jpg", image_bytes(), "image/jpeg")},
        data={
            "expected_version": "1",
            "attribution": "Owner",
            "source": "owner_upload",
            "rights_confirmed": "true",
        },
    )
    assert response.status_code == 500
    assert not context.media.objects
    async with context.db() as db:
        row = await db.get(Restaurant, context.ids.restaurant)
        assert row.photo_url is None and row.admin_version == 1


@pytest.mark.asyncio
async def test_csv_reimport_preserves_manual_edits_and_identity(context, monkeypatch):
    from app.core import database
    from scripts.seed_restaurants import SeedRestaurant, persist

    headers = await sign_in(context)
    response = await context.client.patch(
        f"/admin/api/restaurants/{context.ids.restaurant}", headers=headers, json=edit_body()
    )
    assert response.status_code == 200
    monkeypatch.setattr(database, "async_session_factory", context.db)
    inserted, updated = await persist(
        [
            SeedRestaurant(
                place_id="osm:node/123",
                name="Old CSV name",
                primary_category="Other",
                latitude=0,
                longitude=0,
            )
        ],
        clear_existing=False,
    )
    assert (inserted, updated) == (0, 0)
    async with context.db() as db:
        row = await db.get(Restaurant, context.ids.restaurant)
        assert row.name == edit_body()["name"]
        assert row.latitude == edit_body()["latitude"]


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("ADMIN_TEST_POSTGRES_URL"),
    reason="Concurrent row locks require the isolated PostgreSQL CI service",
)
async def test_two_tabs_cannot_commit_the_same_version_concurrently(context):
    headers = await sign_in(context)
    path = f"/admin/api/restaurants/{context.ids.restaurant}"
    responses = await asyncio.gather(
        *[context.client.patch(path, headers=headers, json=edit_body()) for _ in range(2)]
    )
    assert sorted(response.status_code for response in responses) == [200, 409]


@pytest.mark.asyncio
async def test_admin_login_limit_fails_closed(context):
    app.dependency_overrides[get_redis] = lambda: SimpleNamespace(
        eval=AsyncMock(side_effect=ConnectionError("offline"))
    )
    response = await context.client.post(
        "/admin/api/login",
        headers={"Origin": ORIGIN},
        json={
            "email": "admin@example.com",
            "password": PASSWORD,
        },
    )
    assert response.status_code == 503
    assert "ginder_admin" not in context.client.cookies


@pytest.mark.asyncio
async def test_oversized_request_is_rejected_before_parsing(context):
    response = await context.client.post("/admin/api/login", content=b"x" * (65536 + 1))
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_expired_session_and_password_reset_revoke_browser_access(context):
    await sign_in(context)
    async with context.db() as db:
        owner = await db.get(User, context.ids.owner)
        owner.token_version += 1
        await db.commit()
    assert (await context.client.get("/admin/api/session")).status_code == 403
    await sign_in(context)
    async with context.db() as db:
        sessions = (await db.scalars(select(AdminSession))).all()
        for session in sessions:
            session.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        await db.commit()
    assert (await context.client.get("/admin/api/session")).status_code == 401


def test_image_is_reencoded_without_metadata():
    result = prepare_photo(image_bytes())
    with Image.open(io.BytesIO(result)) as image:
        assert image.format == "WEBP"
        assert image.size == (200, 100)
        assert not image.getexif()


@pytest.mark.parametrize(
    "raw",
    [b"<svg></svg>", b"", b"x" * (5 * 1024 * 1024 + 1)],
    ids=["svg", "empty", "oversized"],
)
def test_invalid_or_oversized_image(raw):
    with pytest.raises(HTTPException):
        prepare_photo(raw)


@pytest.mark.parametrize(
    "change",
    [
        {"latitude": float("nan")},
        {"longitude": 181},
        {"primary_category": "Invented"},
        {"is_admin": True},
        {"rating": 5},
    ],
)
def test_invalid_admin_edits_are_rejected(change):
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        RestaurantEdit.model_validate({**edit_body(), **change})
