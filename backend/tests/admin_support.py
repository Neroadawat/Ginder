"""Disposable SQLite adapter for Admin HTTP tests and the local UI preview only.

Production remains PostgreSQL. This adapter does not validate PostgreSQL locking,
Alembic migrations, or AWS IAM; those need the isolated PostgreSQL/AWS checks.
"""

import json
import os

from sqlalchemy import event, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base
from app.models.admin import AdminSession, RestaurantAudit
from app.models.restaurant import Restaurant
from app.models.user import User


@compiles(JSONB, "sqlite")
def jsonb_as_json(_type, _compiler, **_kw):
    return "JSON"


async def test_database(url=None):
    url = url or os.environ.get("ADMIN_TEST_POSTGRES_URL", "sqlite+aiosqlite://")
    parsed = make_url(url)
    if parsed.get_backend_name() != "sqlite":
        # This reset is permitted only for explicitly named local CI databases.
        # Never infer a test connection from production's DATABASE_URL.
        if (
            parsed.get_backend_name() != "postgresql"
            or parsed.host not in {"localhost", "127.0.0.1"}
            or not (parsed.database or "").startswith("ginder_admin_check_")
        ):
            raise ValueError("Admin integration tests require an isolated local check database")
        engine = create_async_engine(url)
        async with engine.begin() as connection:
            await connection.execute(
                text("TRUNCATE restaurant_audits, admin_sessions, restaurants, users CASCADE")
            )
        return engine, async_sessionmaker(engine, expire_on_commit=False)
    engine = create_async_engine(url)

    @event.listens_for(engine.sync_engine, "connect")
    def sqlite_functions(connection, _record):
        def array_length(value):
            decoded = json.loads(value) if value else None
            return len(decoded) if isinstance(decoded, list) else None

        connection.create_function("jsonb_array_length", 1, array_length)
        connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as connection:
        await connection.run_sync(
            lambda conn: Base.metadata.create_all(
                conn,
                tables=[
                    User.__table__,
                    Restaurant.__table__,
                    AdminSession.__table__,
                    RestaurantAudit.__table__,
                ],
            )
        )
    return engine, async_sessionmaker(engine, expire_on_commit=False)


test_database.__test__ = False
