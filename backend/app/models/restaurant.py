"""Provider-neutral restaurant model."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    __table_args__ = (
        # Backs the bounding-box prefilter used by radius search.
        Index("ix_restaurants_lat_lng", "latitude", "longitude"),
        # Lets the cleanup cronjob find expired TTL rows cheaply.
        Index("ix_restaurants_is_permanent_expires_at", "is_permanent", "expires_at"),
        Index("ix_restaurants_source", "source"),
        UniqueConstraint("source", "source_place_id", name="uq_restaurants_source_place_id"),
        CheckConstraint(
            "source IN ('osm', 'manual', 'synthetic')",
            name="ck_restaurants_source",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ─── Provider-neutral identity ───

    # Compatibility identifier used by existing clients and foreign-key flows.
    # It is namespaced, for example ``osm:node/123`` or ``manual:campus-canteen``.
    place_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
    source_place_id: Mapped[str] = mapped_column(String(255), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # ─── Location ───
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ─── Categorisation ───

    # Raw list exactly as the source provides it, e.g.
    # ["thai_restaurant", "restaurant", "food", "establishment"].
    # Stored verbatim so no fidelity is lost when moving to the real API.
    types: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    # Single display category derived from `types` once, at ingest time
    # (requirement 14.4). Indexed so Explore and the category filter stay a
    # plain fast WHERE rather than a JSON query.
    primary_category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # ─── Ratings and price ───

    # Provider-compatible scale: 0 = free, 1 = inexpensive ... 4 = very expensive.
    price_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_ratings_total: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ─── Opening hours ───

    # Google Places shape: {"periods": [{"open": {"day": 0, "time": "0800"},
    #                                    "close": {"day": 0, "time": "2000"}}]}
    # `open_now` is intentionally NOT stored: it is a snapshot that would go
    # stale immediately. The "Open now" filter computes it from `periods`
    # against the current server time (requirement 5.3).
    opening_hours: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # ─── Media and links ───
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    photo_attribution: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_maps_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ─── Data lifecycle (requirement 14.7, 14.8) ───

    # True for rows the team curates. The cleanup cronjob must never delete
    # these, otherwise every seeded restaurant would vanish at midnight.
    is_permanent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # When a cached row becomes stale. NULL means "never expires", which is
    # always the case for permanent rows.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Grid-based key, only meaningful for rows fetched from an external
    # provider. Mock rows are queried by distance instead (requirement 15.4).
    cache_key: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
