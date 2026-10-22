"""Authentication revocation, WebSocket membership and abuse controls."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import UnauthorizedException
from app.core.security import create_access_token, create_refresh_token
from app.schemas.auth import RefreshTokenRequest
from app.services.auth_service import AuthService
from app.services.rate_limit_service import allow_password_reset
from app.websocket.router import authorize_session


def _result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.asyncio
async def test_refresh_rejects_revoked_token() -> None:
    user_id = uuid.uuid4()
    user = SimpleNamespace(id=user_id, is_active=True, token_version=2)
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(user)))
    service = AuthService(db)

    with pytest.raises(UnauthorizedException):
        await service.refresh(
            RefreshTokenRequest(refresh_token=create_refresh_token(str(user_id), 1))
        )


@pytest.mark.asyncio
async def test_refresh_checks_user_and_rotates_current_version() -> None:
    user_id = uuid.uuid4()
    user = SimpleNamespace(id=user_id, is_active=True, token_version=4)
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(user)))
    service = AuthService(db)

    tokens = await service.refresh(
        RefreshTokenRequest(refresh_token=create_refresh_token(str(user_id), 4))
    )

    assert tokens.access_token
    assert tokens.refresh_token


@pytest.mark.asyncio
async def test_websocket_requires_session_membership() -> None:
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(None)))

    authorized = await authorize_session(create_access_token(str(user_id), 0), session_id, db)

    assert authorized is None


@pytest.mark.asyncio
async def test_websocket_accepts_current_member() -> None:
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(SimpleNamespace(id=user_id))))

    authorized = await authorize_session(create_access_token(str(user_id), 3), session_id, db)

    assert authorized == user_id


class FakeRedis:
    def __init__(self):
        self.values: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    async def expire(self, _key: str, _seconds: int) -> bool:
        return True

    async def eval(self, _script, _numkeys, key, seconds):
        count = await self.incr(key)
        if count == 1:
            await self.expire(key, seconds)
        return count


@pytest.mark.asyncio
async def test_password_reset_limit_does_not_store_raw_identifiers(monkeypatch) -> None:
    from app.services import rate_limit_service

    monkeypatch.setattr(rate_limit_service.settings, "PASSWORD_RESET_EMAIL_LIMIT", 1)
    redis = FakeRedis()

    assert await allow_password_reset(redis, "Person@Example.com", "203.0.113.10")
    assert not await allow_password_reset(redis, "person@example.com", "203.0.113.10")
    assert all("person@example.com" not in key for key in redis.values)
    assert all("203.0.113.10" not in key for key in redis.values)
