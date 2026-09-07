"""Session and SessionParticipant models."""

import uuid
from datetime import UTC, datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
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

    WAITING = "waiting"       # In lobby, waiting for start
    SWIPING = "swiping"       # Actively swiping
    DONE = "done"             # Finished swiping (deck empty)
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

    # Invite
    invite_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    invite_used: Mapped[bool] = mapped_column(default=False)

    # Filters (stored as part of session config)
    category_filter: Mapped[str | None] = mapped_column(String(100), nullable=True)
    price_filter: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1, 2, 3
    rating_filter: Mapped[float | None] = mapped_column(Float, nullable=True)

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


class SessionParticipant(Base):
    __tablename__ = "session_participants"

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
        Enum(ParticipantStatus), default=ParticipantStatus.WAITING, nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    session = relationship("Session", back_populates="participants")
    user = relationship("User", back_populates="session_participations")
