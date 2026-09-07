"""MatchResult model — final result of a session."""

import uuid
from datetime import UTC, datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ResolutionType(str, PyEnum):
    """How the match was resolved."""

    UNANIMOUS = "unanimous"       # Everyone liked the same restaurant
    MAJORITY = "majority"         # Most votes
    SPIN_WHEEL_TIE = "spin_wheel_tie"   # Tie-breaker spin
    SPIN_WHEEL_NO_MATCH = "spin_wheel_no_match"  # No one liked anything
    EARLY_TERMINATION = "early_termination"  # No unanimous match possible


class MatchResult(Base):
    __tablename__ = "match_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurants.id", ondelete="SET NULL"), nullable=True
    )
    resolution_type: Mapped[ResolutionType] = mapped_column(
        Enum(ResolutionType), nullable=False
    )
    restaurant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    session = relationship("Session", back_populates="match_result")
    restaurant = relationship("Restaurant")
