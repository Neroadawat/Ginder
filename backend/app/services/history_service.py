"""History business logic — match history for a user."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match_result import MatchResult
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionParticipant
from app.models.user import User
from app.schemas.history import MatchHistoryEntry, MatchHistoryResponse


class HistoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_history(self, user: User) -> MatchHistoryResponse:
        """Get match history for the current user (sessions they participated in)."""
        result = await self.db.execute(
            select(MatchResult, Restaurant)
            .outerjoin(Restaurant, Restaurant.id == MatchResult.restaurant_id)
            .join(Session, Session.id == MatchResult.session_id)
            .join(SessionParticipant, SessionParticipant.session_id == Session.id)
            .where(SessionParticipant.user_id == user.id)
            .order_by(MatchResult.created_at.desc())
        )
        rows = result.all()

        entries = [
            MatchHistoryEntry(
                session_id=match.session_id,
                restaurant_name=match.restaurant_name,
                restaurant_image_url=restaurant.image_url if restaurant else None,
                resolution_type=match.resolution_type.value,
                google_maps_url=restaurant.google_maps_url if restaurant else None,
                created_at=match.created_at,
            )
            for match, restaurant in rows
        ]

        return MatchHistoryResponse(history=entries, total=len(entries))
