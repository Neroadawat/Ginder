"""Friend schemas."""

import uuid

from pydantic import BaseModel


class FriendResponse(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str

    model_config = {"from_attributes": True}


class FriendListResponse(BaseModel):
    friends: list[FriendResponse]
    total: int


class FriendSearchQuery(BaseModel):
    query: str
