"""SQLAlchemy models — import all models here for Alembic auto-detection."""

from app.models.friendship import Friendship
from app.models.match_result import MatchResult
from app.models.notification import Notification
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionParticipant
from app.models.user import User
from app.models.vote import Vote

__all__ = [
    "User",
    "Friendship",
    "Session",
    "SessionParticipant",
    "Restaurant",
    "Vote",
    "MatchResult",
    "Notification",
]
