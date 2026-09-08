"""WebSocket route for real-time session communication.

Delivery is push-only from the server's perspective: the client can ping and
will receive broadcast events, but it cannot originate session state (swipes,
match results, etc.) over this channel. Those are all recorded through REST
endpoints, which validate the request and then call
``ConnectionManager.broadcast_to_session`` themselves.
"""

import json
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.websocket.connection_manager import manager
from app.websocket.events import EVENT_ERROR, EVENT_PING, EVENT_PONG

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

                if event == EVENT_PING:
                    await manager.send_to_user(session_id, user_id, EVENT_PONG, {})
                else:
                    await manager.send_to_user(
                        session_id,
                        user_id,
                        EVENT_ERROR,
                        {"message": f"Unknown or unsupported event: {event}"},
                    )

            except json.JSONDecodeError:
                await manager.send_to_user(
                    session_id, user_id, EVENT_ERROR, {"message": "Invalid JSON"}
                )

    except WebSocketDisconnect:
        manager.disconnect(session_id, user_id)
