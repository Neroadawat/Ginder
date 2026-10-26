"""Authentication revocation, WebSocket membership and abuse controls."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import UnauthorizedException
from app.core.security import create_access_token, create_refresh_token, decode_token
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
            RefreshTokenRequest(
                refresh_token=create_refresh_token(str(user_id), 1, str(uuid.uuid4()))
            )
        )


@pytest.mark.asyncio
async def test_refresh_checks_user_and_rotates_current_version() -> None:
    user_id = uuid.uuid4()
    user = SimpleNamespace(id=user_id, is_active=True, token_version=4)
    session_id = uuid.uuid4()
    token = create_refresh_token(str(user_id), 4, str(session_id))
    session = SimpleNamespace(
        id=session_id, user_id=user_id,
        refresh_hash=hashlib.sha256(token.encode()).hexdigest(),
        revoked_at=None, expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_result(user), _result(session)]), flush=AsyncMock()
    )
    service = AuthService(db)

    tokens = await service.refresh(
        RefreshTokenRequest(refresh_token=token)
    )

    assert tokens.access_token
    assert tokens.refresh_token
    assert tokens.refresh_token != token
    assert decode_token(tokens.access_token)["sid"] == str(session_id)
    assert session.refresh_hash == hashlib.sha256(tokens.refresh_token.encode()).hexdigest()


@pytest.mark.asyncio
async def test_replayed_refresh_persists_family_revocation() -> None:
    user_id, session_id = uuid.uuid4(), uuid.uuid4()
    user = SimpleNamespace(id=user_id, is_active=True, token_version=0)
    session = SimpleNamespace(
        id=session_id, refresh_hash="0" * 64, revoked_at=None,
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_result(user), _result(session)]), commit=AsyncMock()
    )
    with pytest.raises(UnauthorizedException, match="reused"):
        await AuthService(db).refresh(RefreshTokenRequest(
            refresh_token=create_refresh_token(str(user_id), 0, str(session_id))
        ))
    assert session.revoked_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_legacy_refresh_requires_new_login() -> None:
    db = SimpleNamespace(execute=AsyncMock())
    with pytest.raises(UnauthorizedException):
        await AuthService(db).refresh(RefreshTokenRequest(
            refresh_token=create_refresh_token(str(uuid.uuid4()))
        ))
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("expired,revoked", [(True, False), (False, True)])
async def test_refresh_rejects_expired_or_revoked_login(expired, revoked) -> None:
    user_id, session_id = uuid.uuid4(), uuid.uuid4()
    user = SimpleNamespace(id=user_id, is_active=True, token_version=0)
    session = SimpleNamespace(
        expires_at=datetime.now(UTC) + timedelta(days=-1 if expired else 1),
        revoked_at=datetime.now(UTC) if revoked else None,
    )
    db = SimpleNamespace(execute=AsyncMock(side_effect=[_result(user), _result(session)]))
    with pytest.raises(UnauthorizedException):
        await AuthService(db).refresh(RefreshTokenRequest(
            refresh_token=create_refresh_token(str(user_id), 0, str(session_id))
        ))


@pytest.mark.asyncio
async def test_logout_revokes_only_addressed_family_and_is_idempotent() -> None:
    user_id, session_id = uuid.uuid4(), uuid.uuid4()
    session = SimpleNamespace(revoked_at=None)
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(session)))
    body = RefreshTokenRequest(
        refresh_token=create_refresh_token(str(user_id), 0, str(session_id))
    )
    await AuthService(db).logout(body)
    revoked_at = session.revoked_at
    await AuthService(db).logout(body)
    assert session.revoked_at == revoked_at
    query = str(db.execute.call_args.args[0])
    assert "auth_sessions.id =" in query and "auth_sessions.user_id =" in query


@pytest.mark.asyncio
async def test_access_and_websocket_check_login_revocation() -> None:
    from app.services.auth_session_service import is_login_active

    payload = {"sub": str(uuid.uuid4()), "sid": str(uuid.uuid4())}
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(None)))
    assert not await is_login_active(payload, db)
    db.execute.return_value = _result(uuid.uuid4())
    assert await is_login_active(payload, db)
    assert not await is_login_active({**payload, "sid": "bad"}, db)


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
