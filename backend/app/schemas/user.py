"""User schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Display name cannot be blank")
        return normalized


class UpdateFCMTokenRequest(BaseModel):
    fcm_token: str | None = Field(default=None, max_length=500)
