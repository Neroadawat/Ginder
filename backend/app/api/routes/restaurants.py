"""Restaurant routes — explore categories, get deck (solo mode)."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.restaurant import DeckResponse, RestaurantCardResponse, SoloFilterRequest
from app.services.restaurant_service import RestaurantService

router = APIRouter()


@router.get("/categories", response_model=list[str])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get available restaurant categories for the Explore page."""
    service = RestaurantService(db)
    return await service.get_categories()


@router.post("/deck", response_model=DeckResponse)
async def get_solo_deck(
    body: SoloFilterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a deck of restaurants for solo mode based on filters."""
    service = RestaurantService(db)
    return await service.get_solo_deck(body, current_user)


@router.get("/{restaurant_id}", response_model=RestaurantCardResponse)
async def get_restaurant(
    restaurant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific restaurant."""
    service = RestaurantService(db)
    return await service.get_restaurant(restaurant_id)
