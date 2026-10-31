"""Restaurant routes — explore categories, get deck (solo mode)."""

import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.restaurant import (
    DeckResponse,
    GooglePhotoResponse,
    RestaurantCardResponse,
    SoloFilterRequest,
)
from app.services.google_places_service import GooglePlacesService
from app.services.restaurant_service import RestaurantService

router = APIRouter()


def _actor_key(user: User) -> str:
    # Keep cooldowns stable across network changes and devices of one account.
    return hashlib.sha256(f"user:{user.id}".encode()).hexdigest()[:24]


@router.get("/categories", response_model=list[str])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get available restaurant categories for the Explore page."""
    service = RestaurantService(db)
    return await service.get_categories()


@router.post("/deck", response_model=DeckResponse)
async def get_solo_deck(
    body: SoloFilterRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a deck of restaurants for solo mode based on filters."""
    # Live Google metadata stays out of shared HTTP caches.
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    service = RestaurantService(db)
    return await service.get_solo_deck(
        body, current_user, actor_key=_actor_key(current_user)
    )


@router.get("/google-photo", response_model=GooglePhotoResponse)
async def get_google_photo(
    response: Response,
    photo_name: str = Query(
        min_length=10,
        max_length=1024,
        pattern=r"^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$",
    ),
    current_user: User = Depends(get_current_user),
):
    """Compatibility endpoint: photos are disabled, including for older apps."""
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return await GooglePlacesService().get_photo_uri(
        photo_name=photo_name,
        actor_key=_actor_key(current_user),
    )


@router.get("/{restaurant_id}", response_model=RestaurantCardResponse)
async def get_restaurant(
    restaurant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific restaurant."""
    service = RestaurantService(db)
    return await service.get_restaurant(restaurant_id)
