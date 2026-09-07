"""Session schemas — create, join, lobby, status."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float
    duration_seconds: int
    category_filter: str | None = None
    price_filter: int | None = None  # 1, 2, 3
    rating_filter: float | None = None


class SessionResponse(BaseModel):
    id: uuid.UUID
    host_id: uuid.UUID
    status: str
    latitude: float
    longitude: float
    radius_km: float
    duration_seconds: int
    invite_code: str
    category_filter: str | None
    price_filter: int | None
    rating_filter: float | None
    started_at: datetime | None
    ends_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParticipantResponse(BaseModel):
    user_id: uuid.UUID
    display_name: str
    status: str

    model_config = {"from_attributes": True}


class LobbyResponse(BaseModel):
    session: SessionResponse
    participants: list[ParticipantResponse]


class JoinSessionRequest(BaseModel):
    invite_code: str


class StartSessionResponse(BaseModel):
    session_id: uuid.UUID
    status: str
    started_at: datetime
    ends_at: datetime
    deck_size: int


class InviteFriendRequest(BaseModel):
    friend_id: uuid.UUID
