"""Read-only external API quota status."""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.usage import GoogleUsageResponse
from app.services.quota_service import GoogleQuotaService

router = APIRouter()


@router.get("/google", response_model=GoogleUsageResponse)
async def get_google_usage(_current_user: User = Depends(get_current_user)):
    """Current monthly Google Places counters and configured limits."""
    return await GoogleQuotaService().get_google_usage()
