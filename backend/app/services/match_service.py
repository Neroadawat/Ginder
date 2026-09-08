"""Session resolution — majority vote, tie-breaker wheel, no-match wheel.

A session always runs to completion: either everyone finishes their deck or the
timer expires (requirement 9.1/9.2). There is no early termination even when a
unanimous match has become arithmetically impossible.
"""

import random
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match_result import MatchResult, ResolutionType
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionStatus
from app.models.session_deck import SessionDeck
from app.models.vote import Vote
from app.websocket.events import EVENT_RESULT, EVENT_SPIN_WHEEL


@dataclass
class Resolution:
    """Outcome of a session, plus what the wheel should show.

    ``wheel_candidates`` is empty for a clear majority or unanimous win. When
    the wheel is involved it holds exactly the restaurants that went into it,
    so the client can render the same options everyone else sees
    (requirement 9.4).
    """

    result: MatchResult
    wheel_candidates: list[UUID]

    def to_ws_broadcast(self) -> tuple[str, dict]:
        """Event name and payload for broadcasting this outcome over WS.

        A wheel-involved outcome (tie or no-likes) is announced as
        ``EVENT_SPIN_WHEEL`` so the client plays the spin animation before
        showing the result screen; an outright win goes straight to
        ``EVENT_RESULT`` (requirement 9.4, 9.6). Every broadcast site in the
        app (unanimous match, deck-exhausted, timer expiry) funnels through
        this one place so the event name and payload shape can never drift
        apart between call sites.
        """
        event = EVENT_SPIN_WHEEL if self.wheel_candidates else EVENT_RESULT
        payload = {
            "session_id": str(self.result.session_id),
            "restaurant_id": str(self.result.restaurant_id)
            if self.result.restaurant_id
            else None,
            "restaurant_name": self.result.restaurant_name,
            "resolution_type": self.result.resolution_type.value,
            "wheel_candidate_ids": [str(rid) for rid in self.wheel_candidates],
        }
        return event, payload


class MatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve_session(self, session: Session) -> Resolution:
        """Decide the winning restaurant and persist the result.

        Order of precedence:

        1. a single restaurant with the most likes wins outright
        2. a tie is broken by a wheel containing only the tied restaurants
        3. no likes at all sends the whole deck to the wheel
        """
        vote_counts = await self._like_counts(session.id)

        if not vote_counts:
            return await self._resolve_without_likes(session)

        highest = max(vote_counts.values())
        leaders = [rid for rid, count in vote_counts.items() if count == highest]

        if len(leaders) == 1:
            result = await self._persist(session, leaders[0], ResolutionType.MAJORITY)
            return Resolution(result=result, wheel_candidates=[])

        # Tie: only the tied restaurants go on the wheel (requirement 9.4).
        winner_id = random.choice(leaders)
        result = await self._persist(session, winner_id, ResolutionType.SPIN_WHEEL_TIE)
        return Resolution(result=result, wheel_candidates=leaders)

    async def resolve_unanimous(self, session: Session, restaurant_id: UUID) -> Resolution:
        """Persist a unanimous match, which ends the session immediately.

        Two participants can both complete the last required like at nearly
        the same moment (e.g. their swipes land on the server microseconds
        apart), so this can legitimately be called twice concurrently for the
        same session. ``MatchResult.session_id`` is unique, so the loser of
        that race hits an ``IntegrityError`` rather than creating a second,
        conflicting result — that request just reads back the winner's row
        instead of persisting its own (requirement 9.1: a session must settle
        on exactly one outcome).

        The persist attempt runs inside a SAVEPOINT so a conflict only rolls
        back this insert, not the caller's whole transaction — the vote that
        the caller already flushed earlier in the same request (the one that
        completed the match) must survive even if this particular persist
        loses the race.
        """
        try:
            async with self.db.begin_nested():
                result = await self._persist(session, restaurant_id, ResolutionType.UNANIMOUS)
        except IntegrityError:
            result = await self._get_existing_result(session.id)
        return Resolution(result=result, wheel_candidates=[])

    # ─── Private helpers ───

    async def _resolve_without_likes(self, session: Session) -> Resolution:
        """Nobody liked anything, so the whole deck goes on the wheel.

        Reads the persisted deck rather than deriving candidates from votes,
        because a session where everyone disconnected has no votes at all yet
        still needs a result (requirement 9.5).
        """
        result = await self.db.execute(
            select(SessionDeck.restaurant_id)
            .where(SessionDeck.session_id == session.id)
            .order_by(SessionDeck.position)
        )
        deck_ids = [row[0] for row in result.all()]

        if not deck_ids:
            # The search found no restaurants at all, so there is nothing to
            # pick. Recorded so History still shows the session happened.
            match_result = MatchResult(
                session_id=session.id,
                restaurant_id=None,
                resolution_type=ResolutionType.SPIN_WHEEL_NO_MATCH,
                restaurant_name="No restaurant available",
            )
            self.db.add(match_result)
            session.status = SessionStatus.FINISHED
            await self.db.flush()
            return Resolution(result=match_result, wheel_candidates=[])

        winner_id = random.choice(deck_ids)
        match_result = await self._persist(
            session, winner_id, ResolutionType.SPIN_WHEEL_NO_MATCH
        )
        return Resolution(result=match_result, wheel_candidates=deck_ids)

    async def _like_counts(self, session_id: UUID) -> dict[UUID, int]:
        """Number of likes per restaurant in this session."""
        result = await self.db.execute(
            select(Vote.restaurant_id, func.count(Vote.id))
            .where(Vote.session_id == session_id, Vote.liked.is_(True))
            .group_by(Vote.restaurant_id)
        )
        return {row[0]: row[1] for row in result.all()}

    async def _get_existing_result(self, session_id: UUID) -> MatchResult:
        """Read back a result that a concurrent request already persisted."""
        result = await self.db.execute(
            select(MatchResult).where(MatchResult.session_id == session_id)
        )
        match_result = result.scalar_one_or_none()
        if match_result is None:
            # Should not happen: IntegrityError on the unique session_id
            # column means a row is already there. Re-raise rather than
            # silently returning nothing if that assumption ever breaks.
            raise RuntimeError(f"Expected an existing MatchResult for session {session_id}")
        return match_result

    async def _persist(
        self, session: Session, restaurant_id: UUID, resolution_type: ResolutionType
    ) -> MatchResult:
        """Save the result and mark the session finished."""
        result = await self.db.execute(
            select(Restaurant).where(Restaurant.id == restaurant_id)
        )
        restaurant = result.scalar_one_or_none()

        match_result = MatchResult(
            session_id=session.id,
            restaurant_id=restaurant_id,
            resolution_type=resolution_type,
            # Denormalised so History survives the restaurant row being purged.
            restaurant_name=restaurant.name if restaurant else "Unknown restaurant",
        )
        self.db.add(match_result)

        session.status = SessionStatus.FINISHED
        await self.db.flush()

        return match_result
