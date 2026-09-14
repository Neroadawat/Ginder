"""Session business logic — create, join, start, kick, invite, resolve."""

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ForbiddenException,
    NotFoundException,
    SessionAlreadyStartedException,
    UserAlreadyInSessionException,
)
from app.models.match_result import MatchResult
from app.models.session import ParticipantStatus, Session, SessionParticipant, SessionStatus
from app.models.session_deck import SessionDeck
from app.models.user import User
from app.models.vote import Vote
from app.schemas.auth import MessageResponse
from app.schemas.restaurant import DeckResponse
from app.schemas.session import (
    CreateSessionRequest,
    JoinSessionRequest,
    LobbyResponse,
    ParticipantResponse,
    ResolutionResponse,
    SessionResponse,
    StartSessionResponse,
)
from app.services.friend_service import FriendService
from app.services.match_service import MatchService, Resolution
from app.services.notification_service import NotificationService
from app.services.restaurant_service import RestaurantService
from app.websocket.connection_manager import manager
from app.websocket.events import EVENT_SESSION_STARTED, EVENT_USER_JOINED, EVENT_USER_LEFT


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, host: User, body: CreateSessionRequest) -> SessionResponse:
        """Create a lobby with the host as its first participant."""
        await self._ensure_no_active_session(host.id)

        # Eight characters are short enough to type from another phone while
        # still providing more than four billion possible invite codes.
        invite_code = await self._new_invite_code()
        session = Session(
            host_id=host.id,
            latitude=body.latitude,
            longitude=body.longitude,
            radius_km=body.radius_km,
            duration_seconds=body.duration_seconds,
            invite_code=invite_code,
            category_filter=body.category_filter,
            price_filter=body.price_filter,
            rating_filter=body.rating_filter,
            open_now_filter=body.open_now_filter,
        )
        self.db.add(session)
        await self.db.flush()

        self.db.add(
            SessionParticipant(
                session_id=session.id,
                user_id=host.id,
                status=ParticipantStatus.IN_LOBBY,
            )
        )
        await self.db.flush()

        return SessionResponse.model_validate(session)

    async def join_session(self, user: User, body: JoinSessionRequest) -> LobbyResponse:
        """Join a lobby via its invite code.

        The code works for any number of people for as long as the session sits
        in LOBBY, and stops working the instant the host starts it
        (requirement 7.8/7.9). Joining also makes the two users friends
        (requirement 4.1).
        """
        result = await self.db.execute(
            select(Session)
            .options(selectinload(Session.participants).selectinload(SessionParticipant.user))
            .where(Session.invite_code == body.invite_code.strip())
        )
        session = result.scalar_one_or_none()

        if not session:
            raise NotFoundException("Session not found or invalid invite code")

        # Already in? Return the lobby instead of failing, so tapping the link
        # twice is harmless.
        if any(p.user_id == user.id for p in session.participants):
            return await self._build_lobby_response(session)

        if session.status != SessionStatus.LOBBY:
            raise SessionAlreadyStartedException()

        host_id = session.host_id
        if host_id is None:
            # Finished historical sessions may have no host, but an open lobby
            # must always have one.
            raise NotFoundException("Session host no longer exists")

        await self._ensure_no_active_session(user.id)

        self.db.add(
            SessionParticipant(
                session_id=session.id,
                user_id=user.id,
                status=ParticipantStatus.IN_LOBBY,
            )
        )

        friend_service = FriendService(self.db)
        await friend_service.add_friend(user.id, host_id)

        await self.db.flush()
        await self.db.refresh(session, ["participants"])

        # Publish only after the participant is visible to other database
        # connections; otherwise the host can receive the event and refetch
        # the still-old lobby.
        await self.db.commit()

        await manager.broadcast_to_session(
            session.id,
            EVENT_USER_JOINED,
            {"user_id": str(user.id), "display_name": user.display_name},
        )

        return await self._build_lobby_response(session)

    async def get_session(self, session_id: UUID, user: User) -> LobbyResponse:
        """Session details and participant list. Participants only."""
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, user)
        return await self._build_lobby_response(session)

    async def get_deck(self, session_id: UUID, user: User) -> DeckResponse:
        """The session's persisted deck.

        Same cards in the same order for everyone, including after a reconnect
        (requirement 12.5).
        """
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, user)

        if session.status == SessionStatus.LOBBY:
            raise ForbiddenException("The session has not started yet")

        restaurant_service = RestaurantService(self.db)
        return await restaurant_service.get_session_deck(session)

    async def start_session(self, session_id: UUID, host: User) -> StartSessionResponse:
        """Start the session. Host only.

        Shuffles the deck once and persists it, starts the server-side timer,
        and invalidates the invite code by leaving LOBBY.
        """
        session = await self._get_session_with_participants(session_id)

        if session.host_id != host.id:
            raise ForbiddenException("Only the host can start the session")

        if session.status != SessionStatus.LOBBY:
            raise SessionAlreadyStartedException()

        restaurant_service = RestaurantService(self.db)
        deck = await restaurant_service.create_session_deck(session)
        if not deck:
            raise NotFoundException(
                "No restaurants match these filters. Leave this lobby and create a new "
                "session with a wider radius or fewer filters."
            )

        now = datetime.now(UTC)
        session.status = SessionStatus.ACTIVE
        session.started_at = now
        session.ends_at = now + timedelta(seconds=session.duration_seconds)

        for participant in session.participants:
            participant.status = ParticipantStatus.SWIPING

        await NotificationService(self.db).expire_session_invites(session.id)

        await self.db.flush()
        # The WebSocket event can move guests to the swipe screen immediately.
        # Commit first so their deck/timer requests cannot race this transaction.
        await self.db.commit()

        await manager.broadcast_to_session(
            session.id,
            EVENT_SESSION_STARTED,
            {
                "started_at": session.started_at.isoformat(),
                "ends_at": session.ends_at.isoformat(),
                "deck_size": len(deck),
            },
        )

        return StartSessionResponse(
            session_id=session.id,
            status=session.status.value,
            started_at=session.started_at,
            ends_at=session.ends_at,
            deck_size=len(deck),
        )

    async def kick_participant(
        self, session_id: UUID, user_id: UUID, host: User
    ) -> MessageResponse:
        """Remove a participant. Host only, and only before Start."""
        session = await self._get_session_with_participants(session_id)

        if session.host_id != host.id:
            raise ForbiddenException("Only the host can kick participants")

        if session.status != SessionStatus.LOBBY:
            raise ForbiddenException("Participants cannot be kicked after the session starts")

        if user_id == host.id:
            raise ForbiddenException("The host cannot kick themselves")

        participant = next((p for p in session.participants if p.user_id == user_id), None)
        if not participant:
            raise NotFoundException("Participant not found in this session")

        await self.db.delete(participant)
        await self.db.flush()

        await manager.broadcast_to_session(
            session.id, EVENT_USER_LEFT, {"user_id": str(user_id)}
        )

        return MessageResponse(message="Participant removed from session")

    async def leave_session(self, session_id: UUID, user: User) -> MessageResponse:
        """Leave a lobby; leaving as host cancels it for everybody."""
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, user)

        if session.status != SessionStatus.LOBBY:
            raise ForbiddenException("You cannot leave after the session has started")

        if session.host_id == user.id:
            participant_ids = [str(item.user_id) for item in session.participants]
            for participant in list(session.participants):
                await self.db.delete(participant)
            await NotificationService(self.db).expire_session_invites(session.id)
            await self.db.delete(session)
            await self.db.flush()
            await manager.broadcast_to_session(
                session_id,
                EVENT_USER_LEFT,
                {
                    "user_id": str(user.id),
                    "session_cancelled": True,
                    "participants": participant_ids,
                },
            )
            return MessageResponse(message="Session cancelled")

        participant = next(item for item in session.participants if item.user_id == user.id)
        await self.db.delete(participant)
        await self.db.flush()
        await manager.broadcast_to_session(
            session.id, EVENT_USER_LEFT, {"user_id": str(user.id)}
        )
        return MessageResponse(message="You left the session")

    async def invite_friend(
        self, session_id: UUID, friend_id: UUID, host: User
    ) -> MessageResponse:
        """Push a session invite to a friend."""
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, host)

        if session.status != SessionStatus.LOBBY:
            raise ForbiddenException("Cannot invite after the session has started")

        if friend_id == host.id:
            raise ForbiddenException("You cannot invite yourself")

        if not await FriendService(self.db).are_friends(host.id, friend_id):
            raise ForbiddenException("You can only invite people in your friends list")

        if any(participant.user_id == friend_id for participant in session.participants):
            return MessageResponse(message="This friend is already in the lobby")

        notification_service = NotificationService(self.db)
        await notification_service.send_session_invite(
            from_user=host,
            to_user_id=friend_id,
            session=session,
        )

        return MessageResponse(message="Invitation sent")

    # ─── Deck progress and resolution ───

    async def mark_participant_finished(
        self, session_id: UUID, user: User
    ) -> Resolution | None:
        """Record that a participant has swiped their whole deck.

        Sets them to WAITING (requirement 12.1) and resolves the session if
        that was the last person still swiping (requirement 9.2). Returns the
        resolution when the session ended, otherwise None.
        """
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, user)

        if session.status != SessionStatus.ACTIVE:
            return None

        participant = next(p for p in session.participants if p.user_id == user.id)
        participant.status = ParticipantStatus.WAITING
        await self.db.flush()

        if not await self._all_participants_finished(session):
            return None

        return await self.resolve(session)

    async def resolve(self, session: Session) -> Resolution:
        """Close the session, work out the winner, and tell everyone."""
        match_service = MatchService(self.db)
        resolution = await match_service.resolve_session(session)
        await self.db.flush()

        event, payload = resolution.to_ws_broadcast()
        await manager.broadcast_to_session(session.id, event, payload)
        return resolution

    async def get_result(self, session_id: UUID, user: User) -> ResolutionResponse:
        """Read back a finished session's result. Participants only."""
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, user)

        result = await self.db.execute(
            select(MatchResult)
            .options(selectinload(MatchResult.restaurant))
            .where(MatchResult.session_id == session_id)
        )
        match_result = result.scalar_one_or_none()

        if match_result is None:
            raise NotFoundException("This session has not been resolved yet")

        return ResolutionResponse(
            session_id=session_id,
            restaurant_id=match_result.restaurant_id,
            restaurant_name=match_result.restaurant_name,
            resolution_type=match_result.resolution_type.value,
            google_maps_url=(
                match_result.restaurant.google_maps_url if match_result.restaurant else None
            ),
            # The wheel candidates only matter live, while the animation runs.
            wheel_candidate_ids=[],
        )

    async def _all_participants_finished(self, session: Session) -> bool:
        """Whether every participant has swiped their entire deck.

        Compares each participant's vote count against the deck size rather
        than trusting the status column, so a client that never reported
        finishing cannot stall the session forever.
        """
        deck_size = await self.db.scalar(
            select(func.count(SessionDeck.id)).where(SessionDeck.session_id == session.id)
        )
        if not deck_size:
            return True

        result = await self.db.execute(
            select(Vote.user_id, func.count(Vote.id))
            .where(Vote.session_id == session.id)
            .group_by(Vote.user_id)
        )
        votes_per_user = {row[0]: row[1] for row in result.all()}

        return all(
            votes_per_user.get(participant.user_id, 0) >= deck_size
            for participant in session.participants
        )

    # ─── Private helpers ───

    async def get_current_session(self, user: User) -> LobbyResponse | None:
        """Return the user's open session so the app can recover after restart."""
        result = await self.db.execute(
            select(Session)
            .join(SessionParticipant, SessionParticipant.session_id == Session.id)
            .options(selectinload(Session.participants).selectinload(SessionParticipant.user))
            .where(
                SessionParticipant.user_id == user.id,
                Session.status.in_([SessionStatus.LOBBY, SessionStatus.ACTIVE]),
            )
            .order_by(Session.created_at.desc())
        )
        session = result.scalars().first()
        return await self._build_lobby_response(session) if session else None

    async def _new_invite_code(self) -> str:
        """Generate a compact code and guard against the unlikely collision."""
        for _ in range(10):
            code = secrets.token_hex(4).upper()
            exists = await self.db.scalar(
                select(func.count(Session.id)).where(Session.invite_code == code)
            )
            if not exists:
                return code
        # Cryptographically implausible fallback, but never create a duplicate.
        return secrets.token_urlsafe(16)

    async def _ensure_no_active_session(self, user_id: UUID) -> None:
        """Raise if the user is already in a lobby or an active session.

        Enforces one session per user at a time (requirement 7.10).
        """
        result = await self.db.execute(
            select(SessionParticipant)
            .join(Session, Session.id == SessionParticipant.session_id)
            .where(
                SessionParticipant.user_id == user_id,
                Session.status.in_([SessionStatus.LOBBY, SessionStatus.ACTIVE]),
            )
        )
        if result.first():
            raise UserAlreadyInSessionException()

    @staticmethod
    def _ensure_participant(session: Session, user: User) -> None:
        """Raise unless the user belongs to this session (requirement 7.12)."""
        if not any(p.user_id == user.id for p in session.participants):
            raise ForbiddenException("You are not a participant in this session")

    async def _get_session_with_participants(self, session_id: UUID) -> Session:
        """Load a session with its participants and their users."""
        result = await self.db.execute(
            select(Session)
            .options(selectinload(Session.participants).selectinload(SessionParticipant.user))
            .where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundException("Session not found")
        return session

    async def _build_lobby_response(self, session: Session) -> LobbyResponse:
        """Shape a session and its participants for the lobby screen."""
        participants = [
            ParticipantResponse(
                user_id=p.user_id,
                display_name=p.user.display_name,
                status=p.status.value,
            )
            for p in session.participants
        ]
        return LobbyResponse(
            session=SessionResponse.model_validate(session),
            participants=participants,
        )
