"""Regression checks for the application changes recovered from EC2."""

import asyncio
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.core.config import settings
from app.main import app
from app.websocket.connection_manager import ConnectionManager


@pytest.mark.asyncio
@pytest.mark.parametrize("path,status", [("/health/live", 200), ("/missing-route", 404)])
async def test_clock_headers_are_readable_on_success_and_error_responses(path, status):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        response = await client.get(path, headers={"Origin": settings.CORS_ORIGINS[0]})

    assert response.status_code == status
    assert datetime.fromisoformat(response.headers["X-Server-Time"]).utcoffset() is not None
    assert float(response.headers["X-Server-Processing-Ms"]) >= 0
    exposed = {
        header.strip().lower()
        for header in response.headers["Access-Control-Expose-Headers"].split(",")
    }
    assert {"x-server-time", "x-server-processing-ms"} <= exposed


@pytest.mark.asyncio
async def test_slow_participant_does_not_delay_another_participants_message():
    manager = ConnectionManager()
    session_id = uuid.uuid4()
    release_slow = asyncio.Event()
    slow_started = asyncio.Event()
    fast_received = asyncio.Event()

    async def slow_send(_message):
        slow_started.set()
        await release_slow.wait()

    async def fast_send(_message):
        fast_received.set()

    slow = MagicMock(accept=AsyncMock(), send_text=AsyncMock(side_effect=slow_send))
    fast = MagicMock(accept=AsyncMock(), send_text=AsyncMock(side_effect=fast_send))
    authorize = AsyncMock(return_value=True)
    await manager.connect(slow, session_id, uuid.uuid4(), authorize)
    await manager.connect(fast, session_id, uuid.uuid4(), authorize)

    delivery = asyncio.create_task(manager.deliver_local(session_id, "match", {"ok": True}))
    try:
        await asyncio.wait_for(slow_started.wait(), timeout=1)
        await asyncio.wait_for(fast_received.wait(), timeout=1)
        assert not release_slow.is_set()
        assert not delivery.done()
    finally:
        release_slow.set()
        await asyncio.wait_for(delivery, timeout=1)

    assert slow.send_text.await_args == fast.send_text.await_args


@pytest.mark.asyncio
async def test_failed_participant_is_removed_without_interrupting_other_delivery():
    manager = ConnectionManager()
    session_id, failed_user, healthy_user = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    failed = MagicMock(
        accept=AsyncMock(), send_text=AsyncMock(side_effect=RuntimeError("connection lost"))
    )
    healthy = MagicMock(accept=AsyncMock(), send_text=AsyncMock())
    authorize = AsyncMock(return_value=True)
    await manager.connect(failed, session_id, failed_user, authorize)
    await manager.connect(healthy, session_id, healthy_user, authorize)

    await manager.deliver_local(session_id, "match", {"ok": True})

    healthy.send_text.assert_awaited_once()
    assert manager.get_connected_users(session_id) == [healthy_user]
    assert failed not in manager.authorizers
