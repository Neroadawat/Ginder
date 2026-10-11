"""Restaurant routes — explore categories, get deck (solo mode)."""

import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
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


def _actor_key(request: Request, user: User) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(f"{user.id}:{client_ip}".encode()).hexdigest()[:24]


@router.get("/categories", response_model=list[str])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get available restaurant categories for the Explore page."""
    service = RestaurantService(db)
    return await service.get_categories()


@router.post("/deck", response_model=DeckResponse)
async def get_solo_deck(
    body: SoloFilterRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a deck of restaurants for solo mode based on filters."""
    # Live Google cards can contain expiring photo resource names.
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    service = RestaurantService(db)
    return await service.get_solo_deck(
        body, current_user, actor_key=_actor_key(request, current_user)
    )


@router.get("/google-photo", response_model=GooglePhotoResponse)
async def get_google_photo(
    request: Request,
    response: Response,
    photo_name: str = Query(
        min_length=10,
        max_length=1024,
        pattern=r"^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$",
    ),
    current_user: User = Depends(get_current_user),
):
    """Resolve a Google photo URL for the active card without storing it."""
    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return await GooglePlacesService().get_photo_uri(
        photo_name=photo_name,
        actor_key=_actor_key(request, current_user),
    )


@router.get("/{restaurant_id}", response_model=RestaurantCardResponse)
async def get_restaurant(
    restaurant_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific restaurant."""
    service = RestaurantService(db)
    return await service.get_restaurant(restaurant_id)
