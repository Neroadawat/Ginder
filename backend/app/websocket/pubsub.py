"""Redis Pub/Sub bridge for WebSocket broadcasts (requirement 15.6).

Every ``ConnectionManager.broadcast_to_session`` call publishes to Redis
instead of writing to sockets directly. This background task is the other
half: it subscribes once per API process, and for every message published —
by this process, a sibling instance, or a Celery worker — hands it to the
local ``ConnectionManager`` so any client connected *here* receives it.

Without this, scaling to more than one API instance would silently drop
events for any client not connected to the instance that happened to trigger
the broadcast.
"""

import asyncio
import json
import logging
from uuid import UUID

from app.core.redis import redis_client
from app.websocket.connection_manager import WS_BROADCAST_CHANNEL, manager

logger = logging.getLogger(__name__)

_listener_task: asyncio.Task | None = None


async def _listen() -> None:
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(WS_BROADCAST_CHANNEL)
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                payload = json.loads(message["data"])
                session_id = UUID(payload["session_id"])
                await manager.deliver_local(session_id, payload["event"], payload["data"])
            except Exception:
                logger.exception("Failed to process WS broadcast message: %r", message)
    finally:
        await pubsub.unsubscribe(WS_BROADCAST_CHANNEL)


async def start_pubsub_listener() -> None:
    """Start the background subscriber. Call once, at app startup."""
    global _listener_task
    if _listener_task is not None:
        return
    _listener_task = asyncio.create_task(_listen())


async def stop_pubsub_listener() -> None:
    """Cancel the background subscriber. Call at app shutdown."""
    global _listener_task
    if _listener_task is None:
        return
    _listener_task.cancel()
    try:
        await _listener_task
    except asyncio.CancelledError:
        pass
    _listener_task = None
