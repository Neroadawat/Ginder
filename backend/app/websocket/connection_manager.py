"""WebSocket connection manager for real-time session events."""

import json
import logging
from uuid import UUID

from fastapi import WebSocket

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

# Single channel carrying every session's events. Messages are tagged with
# their session_id so any subscriber can filter locally.
WS_BROADCAST_CHANNEL = "ws:broadcast"


class ConnectionManager:
    """Manages WebSocket connections grouped by session ID.

    Broadcasts always go through Redis Pub/Sub rather than being delivered
    directly, so an event reaches every connected client no matter which
    process is holding the socket (requirement 15.6). That matters for two
    reasons: the API can run as multiple instances behind a load balancer, and
    the Celery worker that resolves a session on timer expiry has no
    WebSocket connections of its own — it can only publish. A background
    subscriber started at app startup (``app.websocket.pubsub``) receives
    published messages and hands them to ``deliver_local``.
    """

    def __init__(self):
        # session_id -> {user_id -> WebSocket}
        self.active_connections: dict[UUID, dict[UUID, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: UUID, user_id: UUID):
        """Accept a WebSocket connection and register it for a session."""
        await websocket.accept()
        self.active_connections.setdefault(session_id, {})[user_id] = websocket

    def disconnect(self, session_id: UUID, user_id: UUID):
        """Remove a WebSocket connection."""
        if session_id in self.active_connections:
            self.active_connections[session_id].pop(user_id, None)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, session_id: UUID, event: str, data: dict) -> None:
        """Publish an event for every participant in a session.

        Always published via Redis (never delivered directly) so the same
        code path works whether the caller is this process, a sibling API
        instance, or a Celery worker with no sockets of its own.
        """
        payload = json.dumps({"session_id": str(session_id), "event": event, "data": data})
        try:
            await redis_client.publish(WS_BROADCAST_CHANNEL, payload)
        except Exception:
            logger.exception(
                "Failed to publish WS event %s for session %s; falling back to local delivery",
                event,
                session_id,
            )
            # A broken Redis shouldn't also take down realtime delivery for
            # whoever happens to be connected to this instance.
            await self.deliver_local(session_id, event, data)

    async def deliver_local(self, session_id: UUID, event: str, data: dict) -> None:
        """Send an event to this instance's own connections for a session."""
        message = json.dumps({"event": event, "data": data})
        connections = self.active_connections.get(session_id)
        if not connections:
            return

        disconnected = []
        for user_id, ws in connections.items():
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(session_id, uid)

    async def send_to_user(self, session_id: UUID, user_id: UUID, event: str, data: dict):
        """Send a message to a specific user in a session (local delivery only).

        Used for keep-alive replies and per-connection errors, which only ever
        matter to the instance that owns the socket.
        """
        message = json.dumps({"event": event, "data": data})
        ws = self.active_connections.get(session_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(session_id, user_id)

    def get_connected_users(self, session_id: UUID) -> list[UUID]:
        """Get list of connected user IDs for a session, on this instance."""
        return list(self.active_connections.get(session_id, {}).keys())


# Singleton instance
manager = ConnectionManager()
