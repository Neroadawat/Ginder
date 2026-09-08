"""Session and SessionParticipant models."""

import uuid
from datetime import UTC, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SessionStatus(str, PyEnum):
    """Session lifecycle status."""

    LOBBY = "lobby"
    ACTIVE = "active"
    FINISHED = "finished"


class ParticipantStatus(str, PyEnum):
    """Participant status within a session."""

    IN_LOBBY = "in_lobby"     # Joined, waiting for the host to start
    SWIPING = "swiping"       # Actively swiping
    WAITING = "waiting"       # Finished the deck, waiting for everyone else
    DISCONNECTED = "disconnected"  # Lost connection


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.LOBBY, nullable=False
    )

    # Location & search settings (Host's location)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    radius_km: Mapped[float] = mapped_column(Float, nullable=False)

    # Timer
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Invite.
    # The code stays usable for any number of people while the session is in
    # LOBBY, and stops working the moment the host starts it (requirement
    # 7.8/7.9). Validity is derived from `status`, so there is deliberately no
    # separate "used" flag to fall out of sync.
    invite_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # Filters, frozen as part of the session config when the host creates it.
    category_filter: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Display tier 1-3 (฿ / ฿฿ / ฿฿฿), expanded to Google's 0-4 when searching.
    price_filter: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_filter: Mapped[float | None] = mapped_column(Float, nullable=True)
    open_now_filter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Cache reference
    cache_key: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    host = relationship("User", foreign_keys=[host_id])
    participants = relationship("SessionParticipant", back_populates="session")
    votes = relationship("Vote", back_populates="session")
    match_result = relationship("MatchResult", back_populates="session", uselist=False)
    deck_entries = relationship(
        "SessionDeck",
        back_populates="session",
        order_by="SessionDeck.position",
        cascade="all, delete-orphan",
    )


class SessionParticipant(Base):
    __tablename__ = "session_participants"

    # A multi-use invite link means the same person could tap it twice, so the
    # database enforces one row per user per session (requirement 7.8).
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_session_participant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[ParticipantStatus] = mapped_column(
        Enum(ParticipantStatus), default=ParticipantStatus.IN_LOBBY, nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    session = relationship("Session", back_populates="participants")
    user = relationship("User", back_populates="session_participations")
