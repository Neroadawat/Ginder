"""WebSocket route for real-time session communication.

Delivery is push-only from the server's perspective: the client can ping and
will receive broadcast events, but it cannot originate session state (swipes,
match results, etc.) over this channel. Those are all recorded through REST
endpoints, which validate the request and then call
``ConnectionManager.broadcast_to_session`` themselves.
"""

import json
from uuid import UUID

from fastapi import APIRouter, Header, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.security import decode_token
from app.models.session import SessionParticipant
from app.models.user import User
from app.websocket.connection_manager import manager
from app.websocket.events import EVENT_ERROR, EVENT_PING, EVENT_PONG

ws_router = APIRouter()


async def authorize_session(token: str, session_id: UUID, db) -> UUID | None:
    """Return the member ID only for a current, active access token."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    try:
        user_id = UUID(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None

    result = await db.execute(
        select(User)
        .join(SessionParticipant, SessionParticipant.user_id == User.id)
        .where(
            User.id == user_id,
            User.is_active.is_(True),
            User.token_version == payload.get("ver"),
            SessionParticipant.session_id == session_id,
        )
    )
    if result.scalar_one_or_none() is None:
        return None
    return user_id


@ws_router.websocket("/session/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: UUID,
    authorization: str | None = Header(default=None),
):
    """WebSocket endpoint for real-time session events.

    Connect with an ``Authorization: Bearer <jwt_token>`` header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        await websocket.close(code=4001, reason="Missing token")
        return

    token = authorization.removeprefix("Bearer ").strip()
    async with async_session_factory() as db:
        user_id = await authorize_session(token, session_id, db)
        if user_id is None:
            await websocket.close(code=4003, reason="Session access denied")
            return

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
