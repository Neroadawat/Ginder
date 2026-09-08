"""SessionDeck model — the frozen card order for a party session.

Requirement 8.3/8.4: the deck is shuffled once when the host presses Start and
then never recomputed. Persisting it is what makes several guarantees hold:

* every participant sees the same cards in the same order
* a reconnecting player resumes the identical deck (requirement 12.5)
* vote tallying is meaningful, because "everyone liked this" only makes sense
  if everyone was shown the same set
* the no-match wheel can draw from the whole deck even when nobody swiped at
  all (requirement 9.5), which a votes-derived deck cannot do

Recomputing on demand would break all four the moment the restaurant table
changes mid-session, which the nightly cache cleanup guarantees will happen.
"""

import uuid

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SessionDeck(Base):
    __tablename__ = "session_decks"

    __table_args__ = (
        # One slot per position, and a restaurant cannot appear twice.
        UniqueConstraint("session_id", "position", name="uq_session_deck_position"),
        UniqueConstraint("session_id", "restaurant_id", name="uq_session_deck_restaurant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Zero-based index into the shuffled deck.
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    session = relationship("Session", back_populates="deck_entries")
    restaurant = relationship("Restaurant")
