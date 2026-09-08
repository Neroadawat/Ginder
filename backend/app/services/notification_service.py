"""Notification business logic — create, list, FCM push."""

import asyncio
import json
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.notification import Notification, NotificationType
from app.models.session import Session
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.notification import NotificationListResponse, NotificationResponse

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_notifications(self, user: User) -> NotificationListResponse:
        """Get all notifications for the current user."""
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
        )
        notifications = result.scalars().all()
        unread = sum(1 for n in notifications if not n.is_read)

        return NotificationListResponse(
            notifications=[NotificationResponse.model_validate(n) for n in notifications],
            unread_count=unread,
        )

    async def mark_as_read(self, notification_id: UUID, user: User) -> MessageResponse:
        """Mark a notification as read."""
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user.id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise NotFoundException("Notification not found")

        notification.is_read = True
        await self.db.flush()

        return MessageResponse(message="Notification marked as read")

    async def send_session_invite(
        self,
        from_user: User,
        to_user_id: UUID,
        session: Session,
    ) -> None:
        """Create a session invite notification and send FCM push."""
        # Get the target user
        result = await self.db.execute(select(User).where(User.id == to_user_id))
        to_user = result.scalar_one_or_none()
        if not to_user:
            raise NotFoundException("User not found")

        # Create notification record
        notification = Notification(
            user_id=to_user_id,
            type=NotificationType.SESSION_INVITE,
            title="Session Invite",
            body=f"{from_user.display_name} invited you to a Ginder session!",
            data=json.dumps({
                "session_id": str(session.id),
                "invite_code": session.invite_code,
            }),
        )
        self.db.add(notification)
        await self.db.flush()

        # Send FCM push notification
        if to_user.fcm_token:
            await self._send_fcm_push(to_user.fcm_token, notification)

    async def _send_fcm_push(self, fcm_token: str, notification: Notification) -> None:
        """Send a push notification via Firebase Cloud Messaging.

        The in-app `Notification` row is already saved by the time this runs,
        so a push failure (missing credentials, invalid token, FCM outage)
        must not fail the request or roll back that row — the user still sees
        the invite in the Notifications tab (requirement 13.4) even if the
        push itself never arrives.
        """
        try:
            from app.core.fcm import send_fcm_push

            await asyncio.to_thread(
                send_fcm_push,
                token=fcm_token,
                title=notification.title,
                body=notification.body,
                data={"payload": notification.data or ""},
            )
        except Exception:
            logger.exception("Failed to send FCM push to token ending in ...%s", fcm_token[-6:])
