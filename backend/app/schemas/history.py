"""History schemas — match history for a user."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class MatchHistoryEntry(BaseModel):
    session_id: uuid.UUID
    restaurant_name: str
    restaurant_image_url: str | None
    resolution_type: str
    google_maps_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchHistoryResponse(BaseModel):
    history: list[MatchHistoryEntry]
    total: int
