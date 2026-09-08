"""User business logic — profile, account deletion, FCM token."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.friendship import Friendship
from app.models.session import Session, SessionParticipant, SessionStatus
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import UpdateFCMTokenRequest, UpdateProfileRequest


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_profile(self, user: User, body: UpdateProfileRequest) -> User:
        """Update the user's editable profile fields."""
        if body.display_name is not None:
            user.display_name = body.display_name
        await self.db.flush()
        return user

    async def delete_account(self, user: User) -> MessageResponse:
        """Permanently delete the account and the user's personal data.

        Requirement 1.9 asks for real removal, not deactivation. Rows that
        belong to the user (friendships, session participation, votes,
        notifications) go with them via the FK cascades on those tables.

        Match history is deliberately left in place: it belongs to every
        participant of that session, not just this user, and each result stores
        the restaurant name directly so the remaining players keep their
        history intact.
        """
        # Friendships are stored as two rows, and the reverse row points at the
        # user from the other side, so clear both directions explicitly.
        await self.db.execute(
            delete(Friendship).where(
                (Friendship.user_id == user.id) | (Friendship.friend_id == user.id)
            )
        )

        # Drop the user out of any lobby or running session so the remaining
        # players are not left waiting for someone who no longer exists.
        await self._leave_open_sessions(user)

        await self.db.delete(user)
        await self.db.flush()

        return MessageResponse(message="Account and personal data have been deleted")

    async def update_fcm_token(self, user: User, body: UpdateFCMTokenRequest) -> MessageResponse:
        """Store the device token used for push notifications."""
        user.fcm_token = body.fcm_token
        await self.db.flush()
        return MessageResponse(message="FCM token updated")

    async def _leave_open_sessions(self, user: User) -> None:
        """Remove the user from every lobby or active session."""
        result = await self.db.execute(
            select(SessionParticipant)
            .join(Session, Session.id == SessionParticipant.session_id)
            .where(
                SessionParticipant.user_id == user.id,
                Session.status.in_([SessionStatus.LOBBY, SessionStatus.ACTIVE]),
            )
        )
        for participant in result.scalars().all():
            await self.db.delete(participant)
