"""User business logic — profile, delete account, FCM token."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import UpdateFCMTokenRequest, UpdateProfileRequest


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_profile(self, user: User, body: UpdateProfileRequest) -> User:
        """Update user profile fields."""
        if body.display_name is not None:
            user.display_name = body.display_name
        await self.db.flush()
        return user

    async def delete_account(self, user: User) -> MessageResponse:
        """Soft-delete or hard-delete the user account."""
        user.is_active = False
        await self.db.flush()
        return MessageResponse(message="Account has been deleted")

    async def update_fcm_token(self, user: User, body: UpdateFCMTokenRequest) -> MessageResponse:
        """Update the user's FCM token for push notifications."""
        user.fcm_token = body.fcm_token
        await self.db.flush()
        return MessageResponse(message="FCM token updated")
