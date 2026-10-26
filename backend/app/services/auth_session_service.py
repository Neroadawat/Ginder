"""Shared HTTP/WebSocket login revocation check."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from app.models.auth_session import AuthSession


async def is_login_active(payload: dict, db) -> bool:
    # Legacy access tokens may finish their short lifetime during deployment.
    # Legacy refresh tokens are rejected and require a new login.
    if "sid" not in payload:
        return True
    try:
        session_id, user_id = UUID(payload["sid"]), UUID(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return False
    result = await db.execute(
        select(AuthSession.id).where(
            AuthSession.id == session_id,
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > datetime.now(UTC),
        )
    )
    return result.scalar_one_or_none() is not None
