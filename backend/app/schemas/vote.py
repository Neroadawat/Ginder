"""Vote schemas — swipes and the Likes tab."""

import uuid

from pydantic import BaseModel

from app.schemas.restaurant import RestaurantCardResponse


class SwipeRequest(BaseModel):
    restaurant_id: uuid.UUID
    # True = swiped right (Like), False = swiped left (Skip).
    liked: bool


class SwipeResponse(BaseModel):
    success: bool

    # Set when this swipe completed a unanimous match, which ends the session
    # immediately (requirement 8.10).
    unanimous_match: bool = False
    matched_restaurant_id: uuid.UUID | None = None


class VoteProgressResponse(BaseModel):
    """Restaurant ids the caller already swiped in this session."""

    session_id: uuid.UUID
    restaurant_ids: list[uuid.UUID]


class LikeEntry(BaseModel):
    """One participant's like, for the in-session Likes tab."""

    user_id: uuid.UUID
    display_name: str

    # The full card so the row can show detail and open navigation
    # (requirement 11.3).
    restaurant: RestaurantCardResponse


class SessionLikesResponse(BaseModel):
    session_id: uuid.UUID
    likes: list[LikeEntry]


class SoloLikeRequest(BaseModel):
    restaurant_id: uuid.UUID


class SoloLikeResponse(BaseModel):
    """A restaurant saved from solo mode."""

    id: uuid.UUID
    restaurant: RestaurantCardResponse
