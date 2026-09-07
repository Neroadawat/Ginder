"""WebSocket connection manager for real-time session events."""

import json
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections grouped by session ID."""

    def __init__(self):
        # session_id -> {user_id -> WebSocket}
        self.active_connections: dict[UUID, dict[UUID, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: UUID, user_id: UUID):
        """Accept a WebSocket connection and register it for a session."""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
        self.active_connections[session_id][user_id] = websocket

    def disconnect(self, session_id: UUID, user_id: UUID):
        """Remove a WebSocket connection."""
        if session_id in self.active_connections:
            self.active_connections[session_id].pop(user_id, None)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, session_id: UUID, event: str, data: dict):
        """Broadcast a message to all connected users in a session."""
        message = json.dumps({"event": event, "data": data})
        if session_id in self.active_connections:
            disconnected = []
            for user_id, ws in self.active_connections[session_id].items():
                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected.append(user_id)
            # Clean up disconnected
            for uid in disconnected:
                self.disconnect(session_id, uid)

    async def send_to_user(self, session_id: UUID, user_id: UUID, event: str, data: dict):
        """Send a message to a specific user in a session."""
        message = json.dumps({"event": event, "data": data})
        if session_id in self.active_connections:
            ws = self.active_connections[session_id].get(user_id)
            if ws:
                try:
                    await ws.send_text(message)
                except Exception:
                    self.disconnect(session_id, user_id)

    def get_connected_users(self, session_id: UUID) -> list[UUID]:
        """Get list of connected user IDs for a session."""
        if session_id in self.active_connections:
            return list(self.active_connections[session_id].keys())
        return []


# Singleton instance
manager = ConnectionManager()
