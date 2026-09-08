"""User schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None


class UpdateFCMTokenRequest(BaseModel):
    fcm_token: str
