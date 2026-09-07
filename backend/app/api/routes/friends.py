"""Friend routes — list, search, unfriend."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.friend import FriendListResponse
from app.services.friend_service import FriendService

router = APIRouter()


@router.get("/", response_model=FriendListResponse)
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all friends of the current user."""
    service = FriendService(db)
    return await service.list_friends(current_user)


@router.get("/search", response_model=FriendListResponse)
async def search_friends(
    q: str = Query(..., min_length=1, max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search among existing friends by display name (not global user search)."""
    service = FriendService(db)
    return await service.search_friends(current_user, q)


@router.delete("/{friend_id}", response_model=MessageResponse)
async def unfriend(
    friend_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a friend. Blocked if both are in the same active session."""
    service = FriendService(db)
    return await service.unfriend(current_user, friend_id)
