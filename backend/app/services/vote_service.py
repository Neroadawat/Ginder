"""Vote business logic — swipe recording, unanimous match detection, likes."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionParticipant, SessionStatus
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


class VoteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_swipe(
        self, session_id: UUID, user: User, body: SwipeRequest
    ) -> SwipeResponse:
        """Record a swipe action and check for unanimous match."""
        # Verify session is active
        result = await self.db.execute(
            select(Session).where(
                Session.id == session_id,
                Session.status == SessionStatus.ACTIVE,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundException("Active session not found")

        # Verify user is a participant
        result = await self.db.execute(
            select(SessionParticipant).where(
                SessionParticipant.session_id == session_id,
                SessionParticipant.user_id == user.id,
            )
        )
        if not result.scalar_one_or_none():
            raise ForbiddenException("You are not a participant in this session")

        # Record vote
        vote = Vote(
            session_id=session_id,
            user_id=user.id,
            restaurant_id=body.restaurant_id,
            liked=body.liked,
        )
        self.db.add(vote)
        await self.db.flush()

        # Check for unanimous match if this was a Like
        unanimous = False
        matched_id = None
        if body.liked:
            unanimous, matched_id = await self._check_unanimous_match(
                session_id, body.restaurant_id
            )

        return SwipeResponse(
            success=True,
            unanimous_match=unanimous,
            matched_restaurant_id=matched_id,
        )

    async def get_session_likes(
        self, session_id: UUID, user: User
    ) -> SessionLikesResponse:
        """Get all likes from all participants in a session."""
        result = await self.db.execute(
            select(Vote, User.display_name, Restaurant.name)
            .join(User, User.id == Vote.user_id)
            .join(Restaurant, Restaurant.id == Vote.restaurant_id)
            .where(
                Vote.session_id == session_id,
                Vote.liked == True,  # noqa: E712
            )
        )
        rows = result.all()

        likes = [
            LikeEntry(
                user_id=vote.user_id,
                display_name=display_name,
                restaurant_id=vote.restaurant_id,
                restaurant_name=restaurant_name,
            )
            for vote, display_name, restaurant_name in rows
        ]

        return SessionLikesResponse(session_id=session_id, likes=likes)

    async def solo_like(self, user: User, body: SoloLikeRequest) -> SoloLikeResponse:
        """Save a liked restaurant in solo mode (no session)."""
        # Verify restaurant exists
        result = await self.db.execute(
            select(Restaurant).where(Restaurant.id == body.restaurant_id)
        )
        restaurant = result.scalar_one_or_none()
        if not restaurant:
            raise NotFoundException("Restaurant not found")

        vote = Vote(
            session_id=None,
            user_id=user.id,
            restaurant_id=body.restaurant_id,
            liked=True,
        )
        self.db.add(vote)
        await self.db.flush()

        return SoloLikeResponse(
            id=vote.id,
            restaurant_id=restaurant.id,
            restaurant_name=restaurant.name,
        )

    async def get_solo_likes(self, user: User) -> list[SoloLikeResponse]:
        """Get all solo mode liked restaurants for the current user."""
        result = await self.db.execute(
            select(Vote, Restaurant.name)
            .join(Restaurant, Restaurant.id == Vote.restaurant_id)
            .where(
                Vote.user_id == user.id,
                Vote.session_id.is_(None),
                Vote.liked == True,  # noqa: E712
            )
            .order_by(Vote.created_at.desc())
        )
        rows = result.all()

        return [
            SoloLikeResponse(
                id=vote.id,
                restaurant_id=vote.restaurant_id,
                restaurant_name=name,
            )
            for vote, name in rows
        ]

    # ─── Private helpers ───

    async def _check_unanimous_match(
        self, session_id: UUID, restaurant_id: UUID
    ) -> tuple[bool, UUID | None]:
        """Check if all participants have liked the same restaurant."""
        # Get total participant count
        result = await self.db.execute(
            select(SessionParticipant).where(
                SessionParticipant.session_id == session_id
            )
        )
        total_participants = len(result.scalars().all())

        # Count likes for this restaurant
        result = await self.db.execute(
            select(Vote).where(
                Vote.session_id == session_id,
                Vote.restaurant_id == restaurant_id,
                Vote.liked == True,  # noqa: E712
            )
        )
        like_count = len(result.scalars().all())

        if like_count >= total_participants:
            return True, restaurant_id

        return False, None
