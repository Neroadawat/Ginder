"""Match resolution logic — majority vote, tie-breaker, spin wheel."""

import random
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match_result import MatchResult, ResolutionType
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionStatus
from app.models.vote import Vote


class MatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve_session(self, session_id: UUID) -> MatchResult:
        """Resolve a session when time is up or early termination is triggered.

        Resolution priority:
        1. Majority vote — restaurant with most likes
        2. Tie-breaker — spin wheel among tied restaurants
        3. No match — spin wheel among all restaurants in deck
        """
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("Session not found")

        # Get vote counts per restaurant (only likes)
        vote_counts = await self._get_vote_counts(session_id)

        if not vote_counts:
            # No one liked anything → spin wheel with all deck restaurants
            return await self._resolve_no_match(session)

        max_votes = max(vote_counts.values())
        top_restaurants = [rid for rid, count in vote_counts.items() if count == max_votes]

        if len(top_restaurants) == 1:
            # Clear majority winner
            return await self._create_result(
                session, top_restaurants[0], ResolutionType.MAJORITY
            )
        else:
            # Tie → spin wheel among top restaurants
            winner_id = random.choice(top_restaurants)
            return await self._create_result(
                session, winner_id, ResolutionType.SPIN_WHEEL_TIE
            )

    async def create_unanimous_result(
        self, session_id: UUID, restaurant_id: UUID
    ) -> MatchResult:
        """Create a result when unanimous match is detected."""
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        return await self._create_result(session, restaurant_id, ResolutionType.UNANIMOUS)

    async def check_early_termination(self, session_id: UUID) -> bool:
        """Check if unanimous match is still possible.

        Returns True if session should be terminated early.
        """
        # Get all participants
        from app.models.session import SessionParticipant

        result = await self.db.execute(
            select(SessionParticipant.user_id).where(
                SessionParticipant.session_id == session_id
            )
        )
        participant_ids = [row[0] for row in result.all()]
        total = len(participant_ids)

        if total <= 1:
            return False

        # Get all restaurants that still have a chance of unanimous match
        # A restaurant is eliminated if any participant has skipped it
        result = await self.db.execute(
            select(Vote.restaurant_id)
            .where(
                Vote.session_id == session_id,
                Vote.liked == False,  # noqa: E712
            )
            .distinct()
        )
        skipped_restaurants = {row[0] for row in result.all()}

        # Get all restaurants that have been liked by at least one person
        result = await self.db.execute(
            select(Vote.restaurant_id)
            .where(
                Vote.session_id == session_id,
                Vote.liked == True,  # noqa: E712
            )
            .distinct()
        )
        liked_restaurants = {row[0] for row in result.all()}

        # Check if any liked restaurant hasn't been skipped by anyone
        possible_unanimousrestaurants = liked_restaurants - skipped_restaurants
        return len(possible_unanimousrestaurants) == 0

    # ─── Private helpers ───

    async def _get_vote_counts(self, session_id: UUID) -> dict[UUID, int]:
        """Get vote count per restaurant (likes only)."""
        result = await self.db.execute(
            select(Vote.restaurant_id, func.count(Vote.id))
            .where(
                Vote.session_id == session_id,
                Vote.liked == True,  # noqa: E712
            )
            .group_by(Vote.restaurant_id)
        )
        return {row[0]: row[1] for row in result.all()}

    async def _resolve_no_match(self, session: Session) -> MatchResult:
        """No one liked anything → spin wheel with all restaurants."""
        # Get all restaurant IDs from votes in this session (the deck)
        result = await self.db.execute(
            select(Vote.restaurant_id)
            .where(Vote.session_id == session.id)
            .distinct()
        )
        all_restaurant_ids = [row[0] for row in result.all()]

        if not all_restaurant_ids:
            # Edge case: no votes at all
            session.status = SessionStatus.FINISHED
            return MatchResult(
                session_id=session.id,
                restaurant_id=None,
                resolution_type=ResolutionType.SPIN_WHEEL_NO_MATCH,
                restaurant_name="No restaurant selected",
            )

        winner_id = random.choice(all_restaurant_ids)
        return await self._create_result(
            session, winner_id, ResolutionType.SPIN_WHEEL_NO_MATCH
        )

    async def _create_result(
        self, session: Session, restaurant_id: UUID, resolution_type: ResolutionType
    ) -> MatchResult:
        """Create and save a MatchResult."""
        result = await self.db.execute(
            select(Restaurant).where(Restaurant.id == restaurant_id)
        )
        restaurant = result.scalar_one_or_none()

        match_result = MatchResult(
            session_id=session.id,
            restaurant_id=restaurant_id,
            resolution_type=resolution_type,
            restaurant_name=restaurant.name if restaurant else "Unknown",
        )
        self.db.add(match_result)

        session.status = SessionStatus.FINISHED
        await self.db.flush()

        return match_result
