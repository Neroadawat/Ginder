"""Scheduled cleanup — expiring cached restaurants, closing overdue sessions."""

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import selectinload

from app.core.database import async_session_factory
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionParticipant, SessionStatus
from app.models.session_deck import SessionDeck
from app.models.vote import Vote
from app.services.match_service import MatchService
from app.tasks.celery_app import celery_app
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.cleanup.cleanup_restaurant_cache")
def cleanup_restaurant_cache() -> int:
    """Delete expired cached restaurants. Runs nightly.

    Only touches expired TTL rows that are not referenced by a persisted deck
    or vote. Curated mock data is flagged ``is_permanent`` and must survive
    (requirement 14.8).
    """
    return asyncio.run(_cleanup_restaurant_cache())


async def _cleanup_restaurant_cache() -> int:
    now = datetime.now(UTC)

    async with async_session_factory() as session:
        result = await session.execute(
            delete(Restaurant).where(
                Restaurant.is_permanent.is_(False),
                Restaurant.expires_at.is_not(None),
                Restaurant.expires_at <= now,
                ~exists().where(SessionDeck.restaurant_id == Restaurant.id),
                ~exists().where(Vote.restaurant_id == Restaurant.id),
            )
        )
        await session.commit()

    deleted = result.rowcount or 0
    logger.info("Cache cleanup removed %s expired restaurant(s)", deleted)
    return deleted


@celery_app.task(name="app.tasks.cleanup.resolve_expired_sessions")
def resolve_expired_sessions() -> int:
    """Close sessions whose countdown has run out.

    The timer is authoritative on the server (requirement 12.7), so a session
    still resolves even if every client has disconnected.
    """
    return asyncio.run(_resolve_expired_sessions())


async def _resolve_expired_sessions() -> int:
    now = datetime.now(UTC)
    resolved = 0

    async with async_session_factory() as db:
        result = await db.execute(
            select(Session)
            .options(selectinload(Session.participants).selectinload(SessionParticipant.user))
            .where(
                Session.status == SessionStatus.ACTIVE,
                Session.ends_at.is_not(None),
                Session.ends_at <= now,
            )
        )
        expired = result.scalars().all()

        match_service = MatchService(db)
        for session in expired:
            try:
                resolution = await match_service.resolve_session(session)
                resolved += 1
                # This worker holds no WebSocket connections itself; publishing
                # via the connection manager relies entirely on the Redis
                # Pub/Sub bridge (requirement 15.6) to reach whichever API
                # instance actually holds each client's socket.
                event, payload = resolution.to_ws_broadcast()
                await manager.broadcast_to_session(session.id, event, payload)
            except Exception:
                # One bad session must not stop the rest from closing.
                logger.exception("Failed to resolve session %s", session.id)

        await db.commit()

    if resolved:
        logger.info("Resolved %s expired session(s)", resolved)
    return resolved
