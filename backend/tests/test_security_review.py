"""Regression checks for the October 2026 security review. No live services."""

import asyncio
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi import HTTPException, WebSocketDisconnect
from pydantic import ValidationError

from app.core.redis import get_redis
from app.core.security import create_password_reset_token
from app.main import app
from app.schemas.auth import LoginRequest, RefreshTokenRequest, ResetPasswordRequest
from app.schemas.session import CreateSessionRequest
from app.services.auth_service import AuthService
from app.services.rate_limit_service import allow_password_reset, enforce_request_limit
from app.services.session_service import SessionService
from app.websocket.connection_manager import ConnectionManager


@pytest.mark.asyncio
async def test_responses_include_a_precise_server_clock():
    before = datetime.now(UTC)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get("/health/live")
    after = datetime.now(UTC)
    assert response.status_code == 200
    assert before <= datetime.fromisoformat(response.headers["x-server-time"]) <= after


@pytest.mark.asyncio
async def test_slow_participant_does_not_delay_match_for_other_participants():
    manager = ConnectionManager()
    session_id = uuid.uuid4()
    release_slow = asyncio.Event()
    fast_received = asyncio.Event()

    async def slow_authorize():
        await release_slow.wait()
        return True

    slow = MagicMock(accept=AsyncMock(), close=AsyncMock(), send_text=AsyncMock())
    fast = MagicMock(
        accept=AsyncMock(),
        close=AsyncMock(),
        send_text=AsyncMock(side_effect=lambda *_: fast_received.set()),
    )
    await manager.connect(slow, session_id, uuid.uuid4(), slow_authorize)
    await manager.connect(fast, session_id, uuid.uuid4(), AsyncMock(return_value=True))
    delivery = asyncio.create_task(manager.deliver_local(session_id, "result", {}))
    try:
        await asyncio.wait_for(fast_received.wait(), timeout=1)
        slow.send_text.assert_not_awaited()
    finally:
        release_slow.set()
        await delivery
    fast.send_text.assert_awaited_once()
    slow.send_text.assert_awaited_once()


@pytest.mark.asyncio
async def test_limiter_is_atomic_and_hashes_identifiers():
    redis = SimpleNamespace(eval=AsyncMock(return_value=31))
    with pytest.raises(HTTPException) as error:
        await enforce_request_limit(redis, "auth:login", "203.0.113.1", 30)
    assert error.value.status_code == 429
    script, _, key, ttl = redis.eval.await_args.args
    assert "INCR" in script and "EXPIRE" in script
    assert "203.0.113.1" not in key
    assert ttl == "300"


@pytest.mark.asyncio
async def test_limiter_outage_never_bypasses_abuse_controls():
    redis = SimpleNamespace(eval=AsyncMock(side_effect=RuntimeError("offline")))
    with pytest.raises(HTTPException) as error:
        await enforce_request_limit(redis, "auth:login", "203.0.113.1", 30)
    assert error.value.status_code == 503
    assert not await allow_password_reset(redis, "a@example.com", "203.0.113.1")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path", ["auth/login", "auth/signup", "auth/refresh", "auth/reset-password", "sessions/join"]
)
async def test_sensitive_routes_apply_shared_limit_before_business_logic(path):
    redis = SimpleNamespace(eval=AsyncMock(return_value=1000))
    app.dependency_overrides[get_redis] = lambda: redis
    bodies = {
        "auth/login": {"email": "a@example.com", "password": "password123"},
        "auth/signup": {
            "email": "a@example.com",
            "password": "password123",
            "display_name": "A",
            "accepted_terms": True,
        },
        "auth/refresh": {"refresh_token": "invalid"},
        "auth/reset-password": {"token": "invalid", "new_password": "password123"},
        "sessions/join": {"invite_code": "12345678"},
    }
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.post(f"/api/v1/{path}", json=bodies[path])
        assert response.status_code == 429
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "schema,body",
    [
        (LoginRequest, {"email": "a@example.com", "password": "x" * 129}),
        (RefreshTokenRequest, {"refresh_token": "x" * 4097}),
        (ResetPasswordRequest, {"token": "x" * 4097, "new_password": "password123"}),
        (
            CreateSessionRequest,
            {"latitude": 14, "longitude": 100, "radius_km": 3, "duration_seconds": 10**15},
        ),
    ],
)
def test_unbounded_security_inputs_are_rejected(schema, body):
    with pytest.raises(ValidationError):
        schema(**body)


@pytest.mark.asyncio
async def test_signed_reset_token_with_invalid_subject_is_rejected_before_sql():
    db = SimpleNamespace(execute=AsyncMock())
    token = create_password_reset_token("not-a-uuid", "hash")
    with pytest.raises(HTTPException) as error:
        await AuthService(db).reset_password(
            ResetPasswordRequest(token=token, new_password="password123")
        )
    assert error.value.status_code == 400
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_revoked_websocket_does_not_receive_broadcast():
    manager = ConnectionManager()
    ws = MagicMock(accept=AsyncMock(), close=AsyncMock(), send_text=AsyncMock())
    session_id, user_id = uuid.uuid4(), uuid.uuid4()
    authorized = AsyncMock(return_value=True)
    await manager.connect(ws, session_id, user_id, authorized)
    await manager.deliver_local(session_id, "test", {})
    ws.send_text.assert_awaited_once()
    authorized.return_value = False
    await manager.deliver_local(session_id, "private", {})
    ws.send_text.assert_awaited_once()
    ws.close.assert_awaited_once_with(code=4003, reason="Session access denied")
    assert manager.get_connected_users(session_id) == []


@pytest.mark.asyncio
async def test_old_socket_cleanup_cannot_unregister_replacement():
    manager = ConnectionManager()
    session_id, user_id = uuid.uuid4(), uuid.uuid4()
    old = MagicMock(accept=AsyncMock(), close=AsyncMock())
    new = MagicMock(accept=AsyncMock(), close=AsyncMock())
    authorize = AsyncMock(return_value=True)
    await manager.connect(old, session_id, user_id, authorize)
    await manager.connect(new, session_id, user_id, authorize)
    manager.disconnect(session_id, user_id, old)
    assert manager.active_connections[session_id][user_id] is new
    assert old not in manager.authorizers


@pytest.mark.asyncio
async def test_membership_changes_serialize_on_account_without_blocking_fk_reads():
    from sqlalchemy.dialects import postgresql

    db = SimpleNamespace(scalar=AsyncMock())
    await SessionService(db)._lock_membership(uuid.uuid4())
    sql = str(db.scalar.await_args.args[0].compile(dialect=postgresql.dialect()))
    assert "FOR NO KEY UPDATE" in sql


@pytest.mark.asyncio
async def test_roster_mutations_lock_and_refresh_session_state():
    from sqlalchemy.dialects import postgresql

    result = MagicMock()
    result.scalar_one_or_none.return_value = SimpleNamespace(id=uuid.uuid4())
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    await SessionService(db)._get_session_with_participants(uuid.uuid4(), lock=True)
    statement = db.execute.await_args.args[0]
    assert "FOR UPDATE" in str(statement.compile(dialect=postgresql.dialect()))
    assert statement.get_execution_options()["populate_existing"]


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", ["[]", "null", "1", '"text"'])
async def test_non_object_websocket_json_does_not_crash_or_leak_connection(monkeypatch, payload):
    import json

    from app.websocket import router

    session_id, user_id = uuid.uuid4(), uuid.uuid4()
    db_context = MagicMock()
    db_context.__aenter__ = AsyncMock(return_value=SimpleNamespace())
    db_context.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(router, "async_session_factory", lambda: db_context)
    monkeypatch.setattr(router, "authorize_session", AsyncMock(return_value=user_id))
    monkeypatch.setattr(router, "enforce_request_limit", AsyncMock())
    manager = ConnectionManager()
    monkeypatch.setattr(router, "manager", manager)
    ws = MagicMock(
        client=SimpleNamespace(host="203.0.113.1"),
        accept=AsyncMock(),
        close=AsyncMock(),
        send_text=AsyncMock(),
        receive_text=AsyncMock(side_effect=[payload, WebSocketDisconnect()]),
    )
    await router.session_websocket(ws, session_id, "Bearer token")
    assert json.loads(ws.send_text.await_args.args[0])["data"] == {"message": "Invalid JSON"}
    assert not manager.get_connected_users(session_id)


@pytest.mark.asyncio
async def test_server_closed_websocket_receive_exits_cleanly(monkeypatch):
    from starlette.websockets import WebSocketDisconnected

    from app.websocket import router

    session_id, user_id = uuid.uuid4(), uuid.uuid4()
    db_context = MagicMock()
    db_context.__aenter__ = AsyncMock(return_value=SimpleNamespace())
    db_context.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(router, "async_session_factory", lambda: db_context)
    monkeypatch.setattr(router, "authorize_session", AsyncMock(return_value=user_id))
    monkeypatch.setattr(router, "enforce_request_limit", AsyncMock())
    manager = ConnectionManager()
    monkeypatch.setattr(router, "manager", manager)
    ws = MagicMock(
        client=SimpleNamespace(host="203.0.113.1"),
        accept=AsyncMock(),
        receive_text=AsyncMock(side_effect=WebSocketDisconnected("Already closed by manager")),
    )

    await router.session_websocket(ws, session_id, "Bearer token")

    assert not manager.get_connected_users(session_id)
    assert ws not in manager.authorizers
