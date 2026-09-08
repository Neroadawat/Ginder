"""Restaurant schemas — Google Places-aligned payloads."""

import uuid

from pydantic import BaseModel, Field, model_serializer

from app.core.config import settings


class RestaurantCardResponse(BaseModel):
    """Restaurant data rendered on a swipe card (requirement 8.5)."""

    id: uuid.UUID
    place_id: str
    name: str

    # Single value for display; the raw list is included so clients can grow
    # richer behaviour later without another API change.
    primary_category: str
    types: list[str] = Field(default_factory=list)

    photo_url: str | None
    latitude: float
    longitude: float
    distance_km: float | None = None

    # Raw Google scale (0-4) plus the ฿ string the UI shows, so clients never
    # have to reimplement the mapping.
    price_level: int | None
    price_symbol: str | None

    rating: float | None
    user_ratings_total: int | None
    address: str | None
    google_maps_url: str | None

    model_config = {"from_attributes": True}

    @model_serializer(mode="wrap")
    def _omit_unknown_rating(self, handler):
        """Drop `rating` entirely when unknown, instead of sending `null`.

        Requirement 8.6 says an unrated restaurant should have its rating
        field hidden, not shown as a fabricated value — and a client that
        checks "is the key present" rather than "is the value truthy" should
        get the same answer. Every other nullable field here is left as-is,
        since only rating carries that specific hide-when-absent rule.
        """
        data = handler(self)
        if self.rating is None:
            data.pop("rating", None)
        return data


class DeckResponse(BaseModel):
    """A deck of restaurant cards for a session or for solo mode."""

    session_id: uuid.UUID | None = None  # None in solo mode
    restaurants: list[RestaurantCardResponse]
    total: int


class SoloFilterRequest(BaseModel):
    """Filter settings for a solo-mode deck."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(
        ge=settings.MIN_RADIUS_KM,
        le=settings.MAX_RADIUS_KM,
        description="Search radius in km, capped for the launch area (requirement 6).",
    )
    category: str | None = None

    # Display tier 1-3 (฿ / ฿฿ / ฿฿฿), expanded server-side to Google's 0-4.
    price_level: int | None = Field(default=None, ge=1, le=3)

    min_rating: float | None = Field(default=None, ge=0, le=5)

    # Requirement 5.3: keep only places open at the current local time.
    open_now: bool = False
