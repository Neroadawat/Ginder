"""History routes — match history for a user."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.history import MatchHistoryResponse
from app.services.history_service import HistoryService

router = APIRouter()


@router.get("/", response_model=MatchHistoryResponse)
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get match history for the current user."""
    service = HistoryService(db)
    return await service.get_history(current_user)
