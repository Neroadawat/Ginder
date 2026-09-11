"""Vote routes — swipe action, likes list, solo likes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.vote import (
    SessionLikesResponse,
    SoloLikeRequest,
    SoloLikeResponse,
    SwipeRequest,
    SwipeResponse,
    VoteProgressResponse,
)
from app.services.vote_service import VoteService

router = APIRouter()


@router.post("/sessions/{session_id}/swipe", response_model=SwipeResponse)
async def swipe(
    session_id: UUID,
    body: SwipeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a swipe action (like/skip) for a restaurant in a session."""
    service = VoteService(db)
    return await service.record_swipe(session_id, current_user, body)


@router.get("/sessions/{session_id}/likes", response_model=SessionLikesResponse)
async def get_session_likes(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all likes from all participants in a session (real-time data)."""
    service = VoteService(db)
    return await service.get_session_likes(session_id, current_user)


@router.get("/sessions/{session_id}/progress", response_model=VoteProgressResponse)
async def get_vote_progress(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the caller's persisted progress for reconnect-safe swiping."""
    service = VoteService(db)
    return await service.get_progress(session_id, current_user)


@router.post("/solo/like", response_model=SoloLikeResponse, status_code=201)
async def solo_like(
    body: SoloLikeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a liked restaurant in solo mode."""
    service = VoteService(db)
    return await service.solo_like(current_user, body)


@router.get("/solo/likes", response_model=list[SoloLikeResponse])
async def get_solo_likes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all solo mode liked restaurants for the current user."""
    service = VoteService(db)
    return await service.get_solo_likes(current_user)
