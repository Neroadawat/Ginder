"""Session schemas — create, join, lobby, start, resolution."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.config import settings


class CreateSessionRequest(BaseModel):
    """Host's configuration for a new party session (requirement 7.1)."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(
        ge=settings.MIN_RADIUS_KM,
        le=settings.MAX_RADIUS_KM,
        description="Search radius in km, capped for the launch area (requirement 6).",
    )
    duration_seconds: int = Field(gt=0, description="Countdown length for the session.")

    category_filter: str | None = None
    # Display tier 1-3 (฿ / ฿฿ / ฿฿฿), expanded server-side to Google's 0-4.
    price_filter: int | None = Field(default=None, ge=1, le=3)
    rating_filter: float | None = Field(default=None, ge=0, le=5)
    open_now_filter: bool = False


class SessionResponse(BaseModel):
    id: uuid.UUID
    # Active and historical sessions can outlive a host account.
    host_id: uuid.UUID | None
    status: str
    latitude: float
    longitude: float
    radius_km: float
    duration_seconds: int
    invite_code: str
    category_filter: str | None
    price_filter: int | None
    rating_filter: float | None
    open_now_filter: bool
    started_at: datetime | None
    ends_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParticipantResponse(BaseModel):
    user_id: uuid.UUID
    display_name: str
    # in_lobby | swiping | waiting | disconnected
    status: str

    model_config = {"from_attributes": True}


class LobbyResponse(BaseModel):
    session: SessionResponse
    participants: list[ParticipantResponse]


class JoinSessionRequest(BaseModel):
    invite_code: str = Field(min_length=1, max_length=50)


class StartSessionResponse(BaseModel):
    session_id: uuid.UUID
    status: str
    started_at: datetime
    ends_at: datetime
    deck_size: int


class InviteFriendRequest(BaseModel):
    friend_id: uuid.UUID


class ResolutionResponse(BaseModel):
    """Final outcome of a session (requirement 9.7)."""

    session_id: uuid.UUID
    restaurant_id: uuid.UUID | None
    restaurant_name: str
    # unanimous | majority | spin_wheel_tie | spin_wheel_no_match
    resolution_type: str
    google_maps_url: str | None = None

    # Restaurants that went on the wheel. Empty when no wheel was needed, so
    # clients can tell a spin apart from an outright win (requirement 9.4).
    wheel_candidate_ids: list[uuid.UUID] = Field(default_factory=list)


class DeckFinishedResponse(BaseModel):
    """Reply to a client reporting it has swiped its whole deck."""

    # True once every participant has finished and the session resolved.
    session_finished: bool
    resolution: ResolutionResponse | None = None
