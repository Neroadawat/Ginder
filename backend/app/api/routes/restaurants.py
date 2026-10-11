"""Restaurant routes — explore categories, get deck (solo mode)."""

import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, Request
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
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a deck of restaurants for solo mode based on filters."""
    service = RestaurantService(db)
    client_ip = request.client.host if request.client else "unknown"
    actor_key = hashlib.sha256(f"{current_user.id}:{client_ip}".encode()).hexdigest()[:24]
    return await service.get_solo_deck(body, current_user, actor_key=actor_key)


@router.get("/{restaurant_id}", response_model=RestaurantCardResponse)
async def get_restaurant(
    restaurant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific restaurant."""
    service = RestaurantService(db)
    return await service.get_restaurant(restaurant_id)
