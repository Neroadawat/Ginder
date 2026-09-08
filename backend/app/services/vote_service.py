"""Vote business logic — swipes, unanimous match detection, the Likes tab."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionParticipant, SessionStatus
from app.models.session_deck import SessionDeck
from app.models.user import User
from app.models.vote import Vote
from app.schemas.vote import (
    LikeEntry,
    SessionLikesResponse,
    SoloLikeRequest,
    SoloLikeResponse,
    SwipeRequest,
    SwipeResponse,
)
from app.services.match_service import MatchService
from app.services.restaurant_service import RestaurantService
from app.websocket.connection_manager import manager
from app.websocket.events import EVENT_LIKE, EVENT_UNANIMOUS_MATCH


class VoteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_swipe(
        self, session_id: UUID, user: User, body: SwipeRequest
    ) -> SwipeResponse:
        """Record a swipe and report whether it completed a unanimous match."""
        # Raises unless the session is running and the caller belongs to it.
        await self._ensure_active_session(session_id)
        await self._ensure_participant(session_id, user.id)
        await self._ensure_in_deck(session_id, body.restaurant_id)

        vote = Vote(
            session_id=session_id,
            user_id=user.id,
            restaurant_id=body.restaurant_id,
            liked=body.liked,
        )
        self.db.add(vote)

        try:
            await self.db.flush()
        except IntegrityError:
            # The unique constraint rejected a repeat vote, which means a
            # duplicate request rather than a real problem.
            await self.db.rollback()
            return SwipeResponse(success=True)

        if not body.liked:
            return SwipeResponse(success=True)

        # This is the authoritative vote path, so it is also the only place
        # that broadcasts EVENT_LIKE — a client-relayed WS event could claim a
        # like that was never actually persisted.
        await manager.broadcast_to_session(
            session_id,
            EVENT_LIKE,
            {"user_id": str(user.id), "restaurant_id": str(body.restaurant_id)},
        )

        matched = await self._is_unanimous(session_id, body.restaurant_id)
        if not matched:
            return SwipeResponse(success=True)

        # Unanimous match: end the session right now rather than merely
        # reporting the flag to the swiper (requirement 8.10). Persisting and
        # broadcasting here, inside the same request that completed the
        # match, means every participant learns about it immediately and no
        # other resolution (majority/timer) can race it afterwards.
        session = await self._get_session(session_id)
        match_service = MatchService(self.db)
        resolution = await match_service.resolve_unanimous(session, body.restaurant_id)
        await self.db.flush()

        await manager.broadcast_to_session(
            session_id,
            EVENT_UNANIMOUS_MATCH,
            {"restaurant_id": str(body.restaurant_id)},
        )
        event, payload = resolution.to_ws_broadcast()
        await manager.broadcast_to_session(session_id, event, payload)

        return SwipeResponse(
            success=True,
            unanimous_match=True,
            matched_restaurant_id=body.restaurant_id,
        )

    async def get_session_likes(self, session_id: UUID, user: User) -> SessionLikesResponse:
        """Every participant's likes in this session (requirement 11.1)."""
        await self._ensure_participant(session_id, user.id)

        result = await self.db.execute(
            select(Vote, User.display_name)
            .join(User, User.id == Vote.user_id)
            .options(selectinload(Vote.restaurant))
            .where(Vote.session_id == session_id, Vote.liked.is_(True))
            .order_by(Vote.created_at.desc())
        )

        restaurant_service = RestaurantService(self.db)
        session = await self._get_session(session_id)

        likes = [
            LikeEntry(
                user_id=vote.user_id,
                display_name=display_name,
                restaurant=restaurant_service.to_card(
                    vote.restaurant, session.latitude, session.longitude
                ),
            )
            for vote, display_name in result.all()
            if vote.restaurant is not None
        ]

        return SessionLikesResponse(session_id=session_id, likes=likes)

    async def solo_like(self, user: User, body: SoloLikeRequest) -> SoloLikeResponse:
        """Save a restaurant liked in solo mode (requirement 10.4)."""
        result = await self.db.execute(
            select(Restaurant).where(Restaurant.id == body.restaurant_id)
        )
        restaurant = result.scalar_one_or_none()
        if not restaurant:
            raise NotFoundException("Restaurant not found")

        # Liking the same place twice should be a no-op, not a duplicate row.
        existing = await self.db.execute(
            select(Vote).where(
                Vote.user_id == user.id,
                Vote.session_id.is_(None),
                Vote.restaurant_id == body.restaurant_id,
            )
        )
        vote = existing.scalar_one_or_none()

        if vote is None:
            vote = Vote(
                session_id=None,
                user_id=user.id,
                restaurant_id=body.restaurant_id,
                liked=True,
            )
            self.db.add(vote)
            await self.db.flush()

        restaurant_service = RestaurantService(self.db)
        return SoloLikeResponse(id=vote.id, restaurant=restaurant_service.to_card(restaurant))

    async def get_solo_likes(self, user: User) -> list[SoloLikeResponse]:
        """The user's personal solo-mode likes (requirement 11.2)."""
        result = await self.db.execute(
            select(Vote)
            .options(selectinload(Vote.restaurant))
            .where(
                Vote.user_id == user.id,
                Vote.session_id.is_(None),
                Vote.liked.is_(True),
            )
            .order_by(Vote.created_at.desc())
        )

        restaurant_service = RestaurantService(self.db)
        return [
            SoloLikeResponse(id=vote.id, restaurant=restaurant_service.to_card(vote.restaurant))
            for vote in result.scalars().all()
            if vote.restaurant is not None
        ]

    # ─── Private helpers ───

    async def _get_session(self, session_id: UUID) -> Session:
        result = await self.db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundException("Session not found")
        return session

    async def _ensure_active_session(self, session_id: UUID) -> None:
        """Raise unless the session exists and is currently running."""
        session = await self._get_session(session_id)
        if session.status != SessionStatus.ACTIVE:
            raise ForbiddenException("This session is not accepting swipes")

    async def _ensure_participant(self, session_id: UUID, user_id: UUID) -> None:
        """Raise unless the user belongs to the session (requirement 7.12)."""
        result = await self.db.execute(
            select(SessionParticipant.id).where(
                SessionParticipant.session_id == session_id,
                SessionParticipant.user_id == user_id,
            )
        )
        if result.first() is None:
            raise ForbiddenException("You are not a participant in this session")

    async def _ensure_in_deck(self, session_id: UUID, restaurant_id: UUID) -> None:
        """Reject votes for restaurants that are not in this session's deck.

        Without this a client could vote for anything and skew the tally.
        """
        result = await self.db.execute(
            select(SessionDeck.id).where(
                SessionDeck.session_id == session_id,
                SessionDeck.restaurant_id == restaurant_id,
            )
        )
        if result.first() is None:
            raise ForbiddenException("That restaurant is not part of this session's deck")

    async def _is_unanimous(self, session_id: UUID, restaurant_id: UUID) -> bool:
        """Whether every participant has liked this restaurant.

        Requirement 8.11: it is only unanimous once each participant has
        actually swiped right, so this compares counts rather than assuming.
        """
        participants = await self.db.scalar(
            select(func.count(SessionParticipant.id)).where(
                SessionParticipant.session_id == session_id
            )
        )
        if not participants:
            return False

        likes = await self.db.scalar(
            select(func.count(Vote.id)).where(
                Vote.session_id == session_id,
                Vote.restaurant_id == restaurant_id,
                Vote.liked.is_(True),
            )
        )

        return (likes or 0) >= participants
