"""User business logic — profile, account deletion, FCM token."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.friendship import Friendship
from app.models.session import Session, SessionParticipant, SessionStatus
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import UpdateFCMTokenRequest, UpdateProfileRequest
from app.services.notification_service import NotificationService


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

        Lobbies hosted by this user are cancelled. Active and finished sessions
        are left in place with a NULL host: they belong to every participant,
        and each result stores the restaurant name directly so the remaining
        players keep their game and history intact.
        """
        # Friendships are stored as two rows, and the reverse row points at the
        # user from the other side, so clear both directions explicitly.
        await self.db.execute(
            delete(Friendship).where(
                (Friendship.user_id == user.id) | (Friendship.friend_id == user.id)
            )
        )

        # Cancel lobbies owned by the user and remove them from every other
        # lobby or running session.
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
        """Cancel owned lobbies and leave every other open session."""
        open_statuses = [SessionStatus.LOBBY, SessionStatus.ACTIVE]

        owned_lobby_ids = list(
            await self.db.scalars(
                select(Session.id).where(
                    Session.host_id == user.id,
                    Session.status == SessionStatus.LOBBY,
                )
            )
        )
        notification_service = NotificationService(self.db)
        for session_id in owned_lobby_ids:
            await notification_service.expire_session_invites(session_id)

        await self.db.execute(
            delete(Session).where(
                Session.host_id == user.id,
                Session.status == SessionStatus.LOBBY,
            )
        )

        open_session_ids = select(Session.id).where(Session.status.in_(open_statuses))
        await self.db.execute(
            delete(SessionParticipant).where(
                SessionParticipant.user_id == user.id,
                SessionParticipant.session_id.in_(open_session_ids),
            )
        )
