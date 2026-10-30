"""Same-origin browser administration. All writes require an admin cookie and CSRF."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.admin_auth import (
    COOKIE,
    check_origin,
    csrf_token,
    get_admin,
    require_admin_enabled,
    session_hash,
)
from app.core.config import settings
from app.core.dependencies import get_db
from app.core.redis import get_redis
from app.core.security import hash_password, verify_password
from app.models.admin import AdminSession, RestaurantAudit
from app.models.restaurant import Restaurant
from app.models.user import User
from app.schemas.admin import CATEGORIES, PhotoMetadata, RestaurantEdit, VersionInput
from app.schemas.auth import LoginRequest
from app.services.rate_limit_service import enforce_request_limit
from app.services.restaurant_media import RestaurantMedia, prepare_photo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin_enabled)])
media_router = APIRouter()
UI = Path(__file__).resolve().parents[2] / "admin_ui"
PHOTO_FIELDS = ("photo_url", "photo_s3_key", "photo_source", "photo_attribution")
EDIT_FIELDS = (
    "name",
    "primary_category",
    "latitude",
    "longitude",
    "address",
    "price_level",
    "opening_hours",
    "admin_notes",
)


@router.get("", include_in_schema=False)
@router.get("/", include_in_schema=False)
async def admin_page():
    return FileResponse(UI / "index.html", headers={"Cache-Control": "no-store"})


@router.get("/assets/{name}", include_in_schema=False)
async def admin_asset(name: Literal["admin.js", "admin.css"]):
    return FileResponse(UI / name, headers={"Cache-Control": "no-cache"})


@router.post("/api/login")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    check_origin(request)
    await enforce_request_limit(
        redis, "admin-login", request.client.host if request.client else "unknown", 10
    )
    user = await db.scalar(select(User).where(func.lower(User.email) == str(body.email).lower()))
    # The dummy hash makes unknown-account requests perform password work too.
    password_hash = (
        user.hashed_password
        if user
        else await run_in_threadpool(hash_password, secrets.token_urlsafe(32))
    )
    valid = await run_in_threadpool(verify_password, body.password, password_hash)
    if user is None or not valid or not user.is_active or not user.is_admin:
        raise HTTPException(401, "Email or password is incorrect, or Admin access is unavailable")
    now = datetime.now(UTC)
    await db.execute(delete(AdminSession).where(AdminSession.expires_at <= now))
    old_token = request.cookies.get(COOKIE, "")
    if old_token:
        await db.execute(
            delete(AdminSession).where(AdminSession.token_hash == session_hash(old_token))
        )
    token = secrets.token_urlsafe(32)
    lifetime = settings.ADMIN_SESSION_HOURS * 3600
    db.add(
        AdminSession(
            token_hash=session_hash(token),
            user_id=user.id,
            token_version=user.token_version,
            expires_at=now + timedelta(seconds=lifetime),
        )
    )
    await db.commit()
    response.set_cookie(
        COOKIE,
        token,
        max_age=lifetime,
        httponly=True,
        samesite="strict",
        path="/admin",
        secure=settings.APP_ENV == "production",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"name": user.display_name, "csrf_token": csrf_token(token), "categories": CATEGORIES}


@router.get("/api/session")
async def session(request: Request, user: User = Depends(get_admin)):
    return {
        "name": user.display_name,
        "csrf_token": csrf_token(request.cookies[COOKIE]),
        "categories": CATEGORIES,
        "photo_storage_ready": bool(settings.RESTAURANT_PHOTO_BUCKET),
    }


@router.post("/api/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(AdminSession).where(AdminSession.token_hash == session_hash(request.cookies[COOKIE]))
    )
    response.delete_cookie(COOKIE, path="/admin")


def _duplicate_names():
    normalized = func.lower(func.trim(Restaurant.name))
    return select(normalized).group_by(normalized).having(func.count() > 1)


def _utc(value):
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _serialize(row: Restaurant) -> dict:
    data = {field: getattr(row, field) for field in EDIT_FIELDS + PHOTO_FIELDS}
    data.update(
        id=str(row.id),
        place_id=row.place_id,
        source=row.source,
        version=row.admin_version,
        reviewed=row.admin_reviewed_at is not None,
        reviewed_at=_utc(row.admin_reviewed_at),
        updated_at=_utc(row.updated_at),
        rating=row.rating,
    )
    return data


@router.get("/api/restaurants")
async def restaurants(
    q: str = "",
    category: str = "",
    issue: Literal["", "missing_photo", "other", "duplicates", "unreviewed", "missing_hours"] = "",
    page: int = 1,
    user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    if len(q) > 100 or len(category) > 100 or page < 1 or page > 10000:
        raise HTTPException(422, "Invalid search or page")
    normalized = func.lower(func.trim(Restaurant.name))
    real = Restaurant.source.in_(("osm", "manual"))
    query = select(Restaurant).where(real)
    if q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Restaurant.name.ilike(f"%{escaped}%", escape="\\"))
    if category:
        query = query.where(Restaurant.primary_category == category)
    issue_filters = {
        "missing_photo": Restaurant.photo_url.is_(None),
        "other": Restaurant.primary_category == "Other",
        "duplicates": normalized.in_(_duplicate_names()),
        "unreviewed": Restaurant.admin_reviewed_at.is_(None),
        "missing_hours": func.coalesce(
            func.jsonb_array_length(Restaurant.opening_hours["periods"]), 0
        )
        == 0,
    }
    if issue:
        query = query.where(issue_filters[issue])
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = (
        await db.scalars(
            query.order_by(Restaurant.name, Restaurant.id).offset((page - 1) * 20).limit(20)
        )
    ).all()
    stats = {}
    for key, condition in {"all": real, **issue_filters}.items():
        stats[key] = await db.scalar(
            select(func.count()).select_from(Restaurant).where(real, condition)
        )
    return {
        "items": [_serialize(row) for row in rows],
        "total": total,
        "page": page,
        "stats": stats,
    }


async def _restaurant(db: AsyncSession, restaurant_id: UUID, version: int | None = None):
    query = select(Restaurant).where(Restaurant.id == restaurant_id)
    if version is not None:
        query = query.with_for_update()
    row = await db.scalar(query.execution_options(populate_existing=True))
    if row is None:
        raise HTTPException(404, "Restaurant not found")
    if version is not None and row.admin_version != version:
        raise HTTPException(409, "This restaurant changed in another tab. Reload before saving")
    return row


@router.get("/api/restaurants/{restaurant_id}")
async def detail(
    restaurant_id: UUID, user: User = Depends(get_admin), db: AsyncSession = Depends(get_db)
):
    row = await _restaurant(db, restaurant_id)
    similar = (
        await db.scalars(
            select(Restaurant).where(
                Restaurant.id != row.id,
                func.lower(func.trim(Restaurant.name)) == row.name.strip().lower(),
            )
        )
    ).all()
    audits = (
        await db.execute(
            select(RestaurantAudit, User.display_name)
            .outerjoin(User, User.id == RestaurantAudit.actor_id)
            .where(RestaurantAudit.restaurant_id == row.id)
            .order_by(RestaurantAudit.created_at.desc(), RestaurantAudit.id)
            .limit(50)
        )
    ).all()
    return {
        "restaurant": _serialize(row),
        "similar": [_serialize(other) for other in similar],
        "history": [
            {
                "action": a.action,
                "actor": name or "Former administrator",
                "created_at": _utc(a.created_at),
                "changes": a.changes,
            }
            for a, name in audits
        ],
    }


def _record(db: AsyncSession, row: Restaurant, user: User, action: str, changes: dict):
    row.admin_version += 1
    row.is_permanent = True
    row.expires_at = None
    db.add(RestaurantAudit(restaurant_id=row.id, actor_id=user.id, action=action, changes=changes))


@router.patch("/api/restaurants/{restaurant_id}")
async def edit(
    restaurant_id: UUID,
    body: RestaurantEdit,
    user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await _restaurant(db, restaurant_id, body.expected_version)
    changes = {}
    values = body.model_dump()
    for field in EDIT_FIELDS:
        old, new = getattr(row, field), values[field]
        if old != new:
            changes[field] = {"before": old, "after": new}
            setattr(row, field, new)
    old_reviewed = row.admin_reviewed_at is not None
    if old_reviewed != body.reviewed:
        changes["reviewed"] = {"before": old_reviewed, "after": body.reviewed}
        row.admin_reviewed_at = datetime.now(UTC) if body.reviewed else None
    if changes:
        _record(db, row, user, "edit", changes)
        await db.flush()
    return _serialize(row)


async def _delete_old(media: RestaurantMedia, key: str | None):
    if key:
        try:
            await run_in_threadpool(media.delete, key)
        except Exception:
            logger.warning("Restaurant photo cleanup failed; retry from storage maintenance")


@router.post("/api/restaurants/{restaurant_id}/photo")
async def upload_photo(
    restaurant_id: UUID,
    file: UploadFile = File(),
    expected_version: int = Form(),
    attribution: str = Form(),
    source: str = Form(),
    rights_confirmed: bool = Form(),
    user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    # Validate metadata before any S3 write. UploadFile is spooled by Starlette;
    # the ASGI body cap bounds multipart parsing before this handler runs.
    from pydantic import ValidationError

    try:
        metadata = PhotoMetadata.model_validate(
            {
                "expected_version": expected_version,
                "attribution": attribution,
                "source": source,
                "rights_confirmed": rights_confirmed,
            }
        )
    except ValidationError:
        raise HTTPException(422, "Add photo credit, source and permission confirmation") from None
    raw = await file.read(settings.RESTAURANT_PHOTO_MAX_BYTES + 1)
    await file.close()
    image = await run_in_threadpool(prepare_photo, raw)
    row = await _restaurant(db, restaurant_id, metadata.expected_version)
    media = await run_in_threadpool(RestaurantMedia)
    photo_id = uuid4()
    key = f"restaurants/{row.id}/{photo_id}.webp"
    before = {field: getattr(row, field) for field in PHOTO_FIELDS}
    try:
        await run_in_threadpool(media.put, key, image)
    except Exception:
        logger.warning("Restaurant photo upload failed")
        raise HTTPException(503, "Photo upload failed. Please retry") from None
    try:
        row.photo_s3_key = key
        row.photo_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/media/{key}"
        row.photo_source = metadata.source
        row.photo_attribution = metadata.attribution
        _record(
            db,
            row,
            user,
            "photo_upload",
            {
                field: {"before": before[field], "after": getattr(row, field)}
                for field in PHOTO_FIELDS
            },
        )
        await db.commit()
    except Exception:
        await db.rollback()
        await _delete_old(media, key)
        raise
    await _delete_old(media, before["photo_s3_key"])
    return _serialize(row)


@router.delete("/api/restaurants/{restaurant_id}/photo")
async def remove_photo(
    restaurant_id: UUID,
    body: VersionInput,
    user: User = Depends(get_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await _restaurant(db, restaurant_id, body.expected_version)
    old_key = row.photo_s3_key
    media = await run_in_threadpool(RestaurantMedia) if old_key else None
    changes = {field: {"before": getattr(row, field), "after": None} for field in PHOTO_FIELDS}
    for field in PHOTO_FIELDS:
        setattr(row, field, None)
    _record(db, row, user, "photo_remove", changes)
    await db.commit()
    if media:
        await _delete_old(media, old_key)
    return _serialize(row)


@media_router.get("/media/restaurants/{restaurant_id}/{photo_id}.webp", include_in_schema=False)
async def photo(restaurant_id: UUID, photo_id: UUID, db: AsyncSession = Depends(get_db)):
    key = f"restaurants/{restaurant_id}/{photo_id}.webp"
    current = await db.scalar(
        select(Restaurant.id).where(Restaurant.id == restaurant_id, Restaurant.photo_s3_key == key)
    )
    if current is None:
        raise HTTPException(404, "Photo not found")
    try:
        media = await run_in_threadpool(RestaurantMedia)
        content = await run_in_threadpool(media.get, key)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Photo temporarily unavailable") from None
    return Response(
        content,
        media_type="image/webp",
        headers={
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )
