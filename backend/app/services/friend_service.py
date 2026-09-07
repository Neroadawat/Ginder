"""Friend business logic — list, search, add (via session), unfriend."""

from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.friendship import Friendship
from app.models.session import Session, SessionParticipant, SessionStatus
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.friend import FriendListResponse, FriendResponse


class FriendService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_friends(self, user: User) -> FriendListResponse:
        """List all friends of the current user."""
        friends = await self._get_friend_users(user.id)
        return FriendListResponse(
            friends=[FriendResponse.model_validate(f) for f in friends],
            total=len(friends),
        )

    async def search_friends(self, user: User, query: str) -> FriendListResponse:
        """Search among existing friends by display name."""
        friends = await self._get_friend_users(user.id)
        filtered = [f for f in friends if query.lower() in f.display_name.lower()]
        return FriendListResponse(
            friends=[FriendResponse.model_validate(f) for f in filtered],
            total=len(filtered),
        )

    async def add_friend(self, user_id: UUID, friend_id: UUID) -> None:
        """Add a bidirectional friendship (called when joining a session via invite)."""
        if user_id == friend_id:
            return

        # Check if already friends
        result = await self.db.execute(
            select(Friendship).where(
                Friendship.user_id == user_id,
                Friendship.friend_id == friend_id,
            )
        )
        if result.scalar_one_or_none():
            return  # Already friends

        # Create bidirectional friendship
        self.db.add(Friendship(user_id=user_id, friend_id=friend_id))
        self.db.add(Friendship(user_id=friend_id, friend_id=user_id))
        await self.db.flush()

    async def unfriend(self, user: User, friend_id: UUID) -> MessageResponse:
        """Remove a friendship. Blocked if both are in the same active session."""
        # Check if both are in the same active session
        if await self._in_same_active_session(user.id, friend_id):
            raise ForbiddenException(
                "Cannot unfriend while both are in the same active session"
            )

        # Delete bidirectional friendship
        result = await self.db.execute(
            select(Friendship).where(
                or_(
                    and_(Friendship.user_id == user.id, Friendship.friend_id == friend_id),
                    and_(Friendship.user_id == friend_id, Friendship.friend_id == user.id),
                )
            )
        )
        friendships = result.scalars().all()
        if not friendships:
            raise NotFoundException("Friendship not found")

        for f in friendships:
            await self.db.delete(f)
        await self.db.flush()

        return MessageResponse(message="Friend removed")

    async def _get_friend_users(self, user_id: UUID) -> list[User]:
        """Get all User objects that are friends with the given user."""
        result = await self.db.execute(
            select(User)
            .join(Friendship, Friendship.friend_id == User.id)
            .where(Friendship.user_id == user_id)
        )
        return list(result.scalars().all())

    async def _in_same_active_session(self, user_id: UUID, other_id: UUID) -> bool:
        """Check if two users are both participants in the same active session."""
        result = await self.db.execute(
            select(SessionParticipant.session_id)
            .join(Session, Session.id == SessionParticipant.session_id)
            .where(
                Session.status == SessionStatus.ACTIVE,
                SessionParticipant.user_id == user_id,
            )
        )
        user_sessions = {row[0] for row in result.all()}

        if not user_sessions:
            return False

        result2 = await self.db.execute(
            select(SessionParticipant.session_id).where(
                SessionParticipant.user_id == other_id,
                SessionParticipant.session_id.in_(user_sessions),
            )
        )
        return result2.first() is not None
