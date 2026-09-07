"""Session business logic — create, join, start, kick, invite."""

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ForbiddenException,
    NotFoundException,
    SessionAlreadyStartedException,
    UserAlreadyInSessionException,
)
from app.models.session import ParticipantStatus, Session, SessionParticipant, SessionStatus
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.restaurant import DeckResponse
from app.schemas.session import (
    CreateSessionRequest,
    JoinSessionRequest,
    LobbyResponse,
    ParticipantResponse,
    SessionResponse,
    StartSessionResponse,
)
from app.services.friend_service import FriendService
from app.services.notification_service import NotificationService
from app.services.restaurant_service import RestaurantService


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, host: User, body: CreateSessionRequest) -> SessionResponse:
        """Create a new lobby. Check user isn't already in a session."""
        await self._ensure_no_active_session(host.id)

        invite_code = secrets.token_urlsafe(16)

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
        )
        self.db.add(session)
        await self.db.flush()

        # Add host as participant
        participant = SessionParticipant(
            session_id=session.id,
            user_id=host.id,
            status=ParticipantStatus.WAITING,
        )
        self.db.add(participant)
        await self.db.flush()

        return SessionResponse.model_validate(session)

    async def join_session(self, user: User, body: JoinSessionRequest) -> LobbyResponse:
        """Join a session via invite code. Auto-add as friend with host."""
        await self._ensure_no_active_session(user.id)

        result = await self.db.execute(
            select(Session)
            .options(selectinload(Session.participants).selectinload(SessionParticipant.user))
            .where(Session.invite_code == body.invite_code)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise NotFoundException("Session not found or invalid invite code")

        if session.status != SessionStatus.LOBBY:
            raise SessionAlreadyStartedException()

        # Mark invite as used (single-use deep link)
        session.invite_used = True

        # Add as participant
        participant = SessionParticipant(
            session_id=session.id,
            user_id=user.id,
            status=ParticipantStatus.WAITING,
        )
        self.db.add(participant)

        # Auto-add as friend with host
        friend_service = FriendService(self.db)
        await friend_service.add_friend(user.id, session.host_id)

        await self.db.flush()

        return await self._build_lobby_response(session)

    async def get_session(self, session_id: UUID, user: User) -> LobbyResponse:
        """Get session details and participant list. Participants only."""
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, user)
        return await self._build_lobby_response(session)

    async def get_deck(self, session_id: UUID, user: User) -> DeckResponse:
        """Get the session's restaurant deck.

        Every participant gets the same deck in the same order, and the same
        deck again after a reconnect (requirement 2.6 "Connection Drop").
        """
        session = await self._get_session_with_participants(session_id)
        self._ensure_participant(session, user)

        if session.status == SessionStatus.LOBBY:
            raise ForbiddenException("The session has not started yet")

        restaurant_service = RestaurantService(self.db)
        return await restaurant_service.get_session_deck(session)

    async def start_session(self, session_id: UUID, host: User) -> StartSessionResponse:
        """Start the session — host only. Generates the restaurant deck."""
        session = await self._get_session_with_participants(session_id)

        if session.host_id != host.id:
            raise ForbiddenException("Only the host can start the session")

        if session.status != SessionStatus.LOBBY:
            raise SessionAlreadyStartedException()

        # Generate restaurant deck
        restaurant_service = RestaurantService(self.db)
        deck = await restaurant_service.generate_session_deck(session)

        # Update session status and timer
        now = datetime.now(UTC)
        session.status = SessionStatus.ACTIVE
        session.started_at = now
        session.ends_at = now + timedelta(seconds=session.duration_seconds)

        # Set all participants to swiping
        for p in session.participants:
            p.status = ParticipantStatus.SWIPING

        await self.db.flush()

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
        """Kick a participant from the lobby (host only, before start)."""
        session = await self._get_session_with_participants(session_id)

        if session.host_id != host.id:
            raise ForbiddenException("Only the host can kick participants")

        if session.status != SessionStatus.LOBBY:
            raise ForbiddenException("Cannot kick after session has started")

        participant = next(
            (p for p in session.participants if p.user_id == user_id),
            None,
        )
        if not participant:
            raise NotFoundException("Participant not found in this session")

        if user_id == host.id:
            raise ForbiddenException("Host cannot kick themselves")

        await self.db.delete(participant)
        await self.db.flush()

        return MessageResponse(message="Participant removed from session")

    async def invite_friend(
        self, session_id: UUID, friend_id: UUID, host: User
    ) -> MessageResponse:
        """Send a session invite notification to a friend."""
        session = await self._get_session_with_participants(session_id)

        if session.status != SessionStatus.LOBBY:
            raise ForbiddenException("Cannot invite after session has started")

        notification_service = NotificationService(self.db)
        await notification_service.send_session_invite(
            from_user=host,
            to_user_id=friend_id,
            session=session,
        )

        return MessageResponse(message="Invitation sent")

    # ─── Private helpers ───

    async def _ensure_no_active_session(self, user_id: UUID) -> None:
        """Raise if user is already in an active (lobby or active) session."""
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
        """Raise unless the user is a participant of this session."""
        if not any(p.user_id == user.id for p in session.participants):
            raise ForbiddenException("You are not a participant in this session")

    async def _get_session_with_participants(self, session_id: UUID) -> Session:
        """Load a session with participants eagerly loaded."""
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
        """Build a lobby response from a session with participants."""
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
