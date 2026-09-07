"""Session routes — create, join, start, lobby, kick, invite."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.restaurant import DeckResponse
from app.schemas.session import (
    CreateSessionRequest,
    InviteFriendRequest,
    JoinSessionRequest,
    LobbyResponse,
    SessionResponse,
    StartSessionResponse,
)
from app.services.session_service import SessionService

router = APIRouter()


@router.post("/", response_model=SessionResponse, status_code=201)
async def create_session(
    body: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new party session (lobby). Host's location is used as center."""
    service = SessionService(db)
    return await service.create_session(current_user, body)


@router.post("/join", response_model=LobbyResponse)
async def join_session(
    body: JoinSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Join an existing session via invite code."""
    service = SessionService(db)
    return await service.join_session(current_user, body)


@router.get("/{session_id}", response_model=LobbyResponse)
async def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get session details and participant list."""
    service = SessionService(db)
    return await service.get_session(session_id, current_user)


@router.get("/{session_id}/deck", response_model=DeckResponse)
async def get_session_deck(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the session's restaurant deck. Same order for everyone, reconnect-safe."""
    service = SessionService(db)
    return await service.get_deck(session_id, current_user)


@router.post("/{session_id}/start", response_model=StartSessionResponse)
async def start_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start the session (host only). Generates the deck and starts the timer."""
    service = SessionService(db)
    return await service.start_session(session_id, current_user)


@router.post("/{session_id}/kick/{user_id}", response_model=MessageResponse)
async def kick_participant(
    session_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kick a participant from the lobby (host only, before start)."""
    service = SessionService(db)
    return await service.kick_participant(session_id, user_id, current_user)


@router.post("/{session_id}/invite", response_model=MessageResponse)
async def invite_friend(
    session_id: UUID,
    body: InviteFriendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a session invite to a friend via push notification."""
    service = SessionService(db)
    return await service.invite_friend(session_id, body.friend_id, current_user)
