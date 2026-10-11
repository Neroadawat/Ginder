"""Production configuration guardrails and health endpoints."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app import main
from app.core.config import Settings


def production_settings(**overrides) -> Settings:
    values = {
        "APP_ENV": "production",
        "DEBUG": False,
        "EXPOSE_API_DOCS": False,
        "SECRET_KEY": "a-unique-production-secret-that-is-long-enough",
        "DATABASE_URL": "postgresql+asyncpg://ginder:secret@db:5432/ginder",
        "REDIS_URL": "redis://:secret@redis:6379/0",
        "RESTAURANT_DATA_MODE": "production",
        "CORS_ORIGINS": ["https://ginder.example.com"],
        "ALLOWED_HOSTS": ["api.ginder.example.com"],
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_safe_production_settings_are_accepted() -> None:
    configured = production_settings()
    assert configured.APP_ENV == "production"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("DEBUG", True),
        ("EXPOSE_API_DOCS", True),
        ("SECRET_KEY", "short"),
        ("RESTAURANT_DATA_MODE", "development"),
        ("CORS_ORIGINS", ["*"]),
        ("CORS_ORIGINS", ["http://ginder.example.com"]),
        ("ALLOWED_HOSTS", ["*"]),
        ("DATABASE_URL", "postgresql+asyncpg://ginder:secret@localhost/ginder"),
        ("REDIS_URL", "redis://localhost:6379/0"),
    ],
)
def test_unsafe_production_setting_is_rejected(field, value) -> None:
    with pytest.raises(ValidationError, match="Unsafe production configuration"):
        production_settings(**{field: value})


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    execute = AsyncMock(return_value=None)


@pytest.mark.asyncio
async def test_readiness_checks_database_and_redis(monkeypatch) -> None:
    session = FakeSession()
    monkeypatch.setattr(main, "async_session_factory", lambda: session)
    ping = AsyncMock(return_value=True)
    monkeypatch.setattr(main, "redis_client", SimpleNamespace(ping=ping))

    result = await main.health_ready()

    assert result == {"status": "ready"}
    session.execute.assert_awaited_once()
    ping.assert_awaited_once()


@pytest.mark.asyncio
async def test_readiness_returns_503_without_leaking_dependency_details(monkeypatch) -> None:
    session = FakeSession()
    session.execute = AsyncMock(side_effect=RuntimeError("database host secret"))
    monkeypatch.setattr(main, "async_session_factory", lambda: session)
    monkeypatch.setattr(
        main, "redis_client", SimpleNamespace(ping=AsyncMock(return_value=True))
    )

    response = await main.health_ready()

    assert response.status_code == 503
    assert response.body == b'{"status":"not_ready"}'
