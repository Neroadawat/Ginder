"""Vote schemas."""

import uuid

from pydantic import BaseModel


class SwipeRequest(BaseModel):
    restaurant_id: uuid.UUID
    liked: bool  # True = Like (swipe right), False = Skip (swipe left)


class SwipeResponse(BaseModel):
    success: bool
    unanimous_match: bool = False
    matched_restaurant_id: uuid.UUID | None = None


class LikeEntry(BaseModel):
    user_id: uuid.UUID
    display_name: str
    restaurant_id: uuid.UUID
    restaurant_name: str


class SessionLikesResponse(BaseModel):
    """Real-time likes from all participants in a session."""

    session_id: uuid.UUID
    likes: list[LikeEntry]


class SoloLikeRequest(BaseModel):
    restaurant_id: uuid.UUID


class SoloLikeResponse(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    restaurant_name: str

    model_config = {"from_attributes": True}
