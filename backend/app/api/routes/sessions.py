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
    DeckFinishedResponse,
    InviteFriendRequest,
    JoinSessionRequest,
    LobbyResponse,
    ResolutionResponse,
    SessionResponse,
    StartSessionResponse,
)
from app.services.match_service import Resolution
from app.services.session_service import SessionService

router = APIRouter()


def build_resolution_response(session_id: UUID, resolution: Resolution) -> ResolutionResponse:
    """Shape a resolved session for the client."""
    result = resolution.result
    restaurant = result.restaurant

    return ResolutionResponse(
        session_id=session_id,
        restaurant_id=result.restaurant_id,
        restaurant_name=result.restaurant_name,
        resolution_type=result.resolution_type.value,
        google_maps_url=restaurant.google_maps_url if restaurant else None,
        wheel_candidate_ids=resolution.wheel_candidates,
    )


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


@router.get("/current", response_model=LobbyResponse | None)
async def get_current_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recover the caller's lobby or active session after an app restart."""
    service = SessionService(db)
    return await service.get_current_session(current_user)


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


@router.get("/{session_id}/result", response_model=ResolutionResponse)
async def get_session_result(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the finished session's winning restaurant."""
    service = SessionService(db)
    return await service.get_result(session_id, current_user)


@router.post("/{session_id}/deck/finished", response_model=DeckFinishedResponse)
async def report_deck_finished(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Report that the caller has swiped their whole deck.

    Puts them in the Waiting state and resolves the session if they were the
    last one still swiping (requirement 9.2, 12.1).
    """
    service = SessionService(db)
    resolution = await service.mark_participant_finished(session_id, current_user)

    if resolution is None:
        return DeckFinishedResponse(session_finished=False)

    return DeckFinishedResponse(
        session_finished=True,
        resolution=build_resolution_response(session_id, resolution),
    )


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


@router.post("/{session_id}/leave", response_model=MessageResponse)
async def leave_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a lobby, or cancel it when called by its host."""
    service = SessionService(db)
    return await service.leave_session(session_id, current_user)


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
