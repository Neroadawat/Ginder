"""Vote model — one row per swipe.

Serves both modes:

* party session — ``session_id`` set, ``liked`` records right or left
* solo mode — ``session_id`` is NULL and only likes are stored, because a solo
  skip is discarded rather than remembered (requirement 10.4)
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Vote(Base):
    __tablename__ = "votes"

    __table_args__ = (
        # A person can only vote once per restaurant within a session. NULL
        # session_id rows (solo likes) are exempt because Postgres treats NULLs
        # as distinct in a unique index.
        UniqueConstraint("session_id", "user_id", "restaurant_id", name="uq_vote_once"),
        # Tallying likes and counting a user's progress are the two hot reads.
        Index("ix_votes_session_restaurant", "session_id", "restaurant_id"),
        Index("ix_votes_session_user", "session_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # NULL for solo-mode likes, which belong to no session.
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False
    )

    # True = swiped right (Like), False = swiped left (Skip).
    liked: Mapped[bool] = mapped_column(Boolean, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    session = relationship("Session", back_populates="votes")
    user = relationship("User", back_populates="votes")
    restaurant = relationship("Restaurant")
