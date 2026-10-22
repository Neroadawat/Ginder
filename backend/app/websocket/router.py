"""WebSocket route for real-time session communication.

Delivery is push-only from the server's perspective: the client can ping and
will receive broadcast events, but it cannot originate session state (swipes,
match results, etc.) over this channel. Those are all recorded through REST
endpoints, which validate the request and then call
``ConnectionManager.broadcast_to_session`` themselves.
"""

import asyncio
import json
from collections import deque
from time import monotonic
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.redis import redis_client
from app.core.security import decode_token
from app.models.session import SessionParticipant
from app.models.user import User
from app.services.rate_limit_service import enforce_request_limit
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

    if len(authorization) > 4103:
        await websocket.close(code=4001, reason="Invalid token")
        return

    try:
        await enforce_request_limit(
            redis_client, "ws-connect", websocket.client.host if websocket.client else "unknown", 60
        )
    except HTTPException:
        await websocket.close(code=1013, reason="Please try again later")
        return

    token = authorization.removeprefix("Bearer ").strip()
    async with async_session_factory() as db:
        user_id = await authorize_session(token, session_id, db)
        if user_id is None:
            await websocket.close(code=4003, reason="Session access denied")
            return

    async def still_authorized() -> bool:
        async with async_session_factory() as db:
            return await authorize_session(token, session_id, db) == user_id

    # Re-check before every outgoing event, not just at the handshake. Kicked,
    # deleted and password-reset accounts must stop receiving private events.
    await manager.connect(websocket, session_id, user_id, still_authorized)
    received_at: deque[float] = deque()

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except TimeoutError:
                if not await still_authorized():
                    await websocket.close(code=4003, reason="Session access denied")
                    return
                continue
            now = monotonic()
            while received_at and received_at[0] < now - 60:
                received_at.popleft()
            received_at.append(now)
            if len(raw) > 4096 or len(received_at) > 60:
                await websocket.close(code=1008, reason="Message limit exceeded")
                return
            try:
                message = json.loads(raw)
                if not isinstance(message, dict):
                    raise ValueError("Message must be an object")
                event = message.get("event")

                if event == EVENT_PING:
                    await manager.send_to_user(session_id, user_id, EVENT_PONG, {})
                else:
                    await manager.send_to_user(
                        session_id,
                        user_id,
                        EVENT_ERROR,
                        {"message": "Unknown or unsupported event"},
                    )

            except (ValueError, RecursionError):
                await manager.send_to_user(
                    session_id, user_id, EVENT_ERROR, {"message": "Invalid JSON"}
                )

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(session_id, user_id, websocket)
