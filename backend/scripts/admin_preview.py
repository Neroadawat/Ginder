"""Run an isolated, loopback-only Admin preview with disposable data and memory photos.

Requires the development dependencies. Never imports production credentials or
connects to PostgreSQL, Redis, EC2 or S3. All changes disappear when it exits.
"""

import secrets
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import uvicorn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402

if settings.APP_ENV == "production":
    raise SystemExit("The local preview cannot run with APP_ENV=production")

from seed_restaurants import load_from_csv  # noqa: E402

from app.api.routes import admin  # noqa: E402
from app.core.dependencies import get_db  # noqa: E402
from app.core.redis import get_redis  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.restaurant import Restaurant  # noqa: E402
from app.models.user import User  # noqa: E402
from tests.admin_support import test_database  # noqa: E402

settings.ADMIN_ENABLED = True
settings.PUBLIC_BASE_URL = "http://127.0.0.1:8010"
settings.RESTAURANT_PHOTO_BUCKET = "local-preview-memory-only"
password = secrets.token_urlsafe(18)


class PreviewMedia:
    objects: dict[str, bytes] = {}

    def put(self, key, image):
        self.objects[key] = image

    def get(self, key):
        return self.objects[key]

    def delete(self, key):
        self.objects.pop(key, None)


@asynccontextmanager
async def preview_lifespan(_app):
    with tempfile.TemporaryDirectory(prefix="ginder-admin-preview-") as directory:
        path = Path(directory) / "preview.sqlite3"
        engine, factory = await test_database(f"sqlite+aiosqlite:///{path.as_posix()}")
        async with factory() as db:
            db.add(
                User(
                    email="preview@example.com",
                    display_name="Local Preview",
                    is_admin=True,
                    hashed_password=hash_password(password),
                )
            )
            for row in load_from_csv(ROOT / "data/thammasat_rangsit_restaurants.csv"):
                db.add(
                    Restaurant(
                        place_id=row.place_id,
                        source=row.source,
                        source_place_id=row.source_place_id,
                        name=row.name,
                        latitude=row.latitude,
                        longitude=row.longitude,
                        primary_category=row.primary_category,
                        address=row.address,
                        opening_hours=row.opening_hours,
                        price_level=row.price_level,
                        is_permanent=True,
                    )
                )
            await db.commit()

        async def preview_db():
            async with factory() as db:
                try:
                    yield db
                    await db.commit()
                except Exception:
                    await db.rollback()
                    raise

        app.dependency_overrides[get_db] = preview_db
        app.dependency_overrides[get_redis] = lambda: SimpleNamespace(
            eval=AsyncMock(return_value=1)
        )
        admin.RestaurantMedia = PreviewMedia
        print("LOCAL PREVIEW ONLY — database and photos are temporary; no AWS connections.")
        print("URL: http://127.0.0.1:8010/admin")
        print("Email: preview@example.com")
        print(f"Temporary password: {password}", flush=True)
        try:
            yield
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()


@app.middleware("http")
async def label_preview(request, call_next):
    response = await call_next(request)
    response.headers["X-Ginder-Preview"] = "true"
    return response


app.router.lifespan_context = preview_lifespan

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8010, access_log=False)
