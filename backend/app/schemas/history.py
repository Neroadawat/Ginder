"""History schemas — a user's past session results."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class MatchHistoryEntry(BaseModel):
    session_id: uuid.UUID

    # Denormalised on the result row, so history survives the restaurant being
    # purged from the cache.
    restaurant_name: str

    photo_url: str | None
    # unanimous | majority | spin_wheel_tie | spin_wheel_no_match
    resolution_type: str
    google_maps_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchHistoryResponse(BaseModel):
    history: list[MatchHistoryEntry]
    total: int
