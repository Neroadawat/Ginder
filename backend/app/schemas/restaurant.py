"""Restaurant schemas."""

import uuid

from pydantic import BaseModel


class RestaurantCardResponse(BaseModel):
    """Restaurant data displayed on a swipe card."""

    id: uuid.UUID
    name: str
    category: str
    image_url: str | None
    latitude: float
    longitude: float
    distance_km: float | None = None
    price_level: int | None  # 1=฿, 2=฿฿, 3=฿฿฿
    rating: float | None
    address: str | None
    google_maps_url: str | None

    model_config = {"from_attributes": True}


class DeckResponse(BaseModel):
    """A deck of restaurant cards for a session."""

    session_id: uuid.UUID | None = None  # None for solo mode
    restaurants: list[RestaurantCardResponse]
    total: int


class SoloFilterRequest(BaseModel):
    """Filter settings for solo mode."""

    latitude: float
    longitude: float
    radius_km: float
    category: str | None = None
    price_level: int | None = None
    min_rating: float | None = None
