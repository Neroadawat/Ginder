"""WebSocket route for real-time session communication."""

import json
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.websocket.connection_manager import manager
from app.websocket.events import (
    EVENT_ERROR,
    EVENT_LIKE,
    EVENT_PING,
    EVENT_PONG,
    EVENT_SWIPE,
)

ws_router = APIRouter()


@ws_router.websocket("/session/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: UUID,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time session events.

    Connect with: ws://host/ws/session/{session_id}?token=<jwt_token>
    """
    # Authenticate via token query param
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = UUID(payload["sub"])

    # Connect
    await manager.connect(websocket, session_id, user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
                event = message.get("event")
                data = message.get("data", {})

                if event == EVENT_PING:
                    await manager.send_to_user(
                        session_id, user_id, EVENT_PONG, {}
                    )

                elif event == EVENT_SWIPE:
                    # Swipe events are handled via REST API for consistency,
                    # but we broadcast the like to other participants via WS
                    if data.get("liked"):
                        await manager.broadcast_to_session(
                            session_id,
                            EVENT_LIKE,
                            {
                                "user_id": str(user_id),
                                "restaurant_id": data.get("restaurant_id"),
                            },
                        )

                else:
                    await manager.send_to_user(
                        session_id,
                        user_id,
                        EVENT_ERROR,
                        {"message": f"Unknown event: {event}"},
                    )

            except json.JSONDecodeError:
                await manager.send_to_user(
                    session_id, user_id, EVENT_ERROR, {"message": "Invalid JSON"}
                )

    except WebSocketDisconnect:
        manager.disconnect(session_id, user_id)
