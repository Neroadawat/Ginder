"""Initial schema.

Creates every table backing the models in ``app/models`` — users,
friendships, restaurants, sessions, session_participants, session_decks,
votes, match_results and notifications — plus the enum types and indexes
referenced throughout the app (bounding-box search, cache cleanup, deck
ordering, per-session vote tallying).

Written by hand rather than via ``alembic revision --autogenerate`` because no
Postgres instance was reachable in this environment; the column set, types,
constraints and indexes here are taken directly from the current
SQLAlchemy models, so `alembic upgrade head` produces the same schema
``Base.metadata`` describes.

Revision ID: 0001
Revises:
Create Date: 2026-09-07
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # ─── users ───
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("accepted_terms", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fcm_token", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ─── friendships ───
    op.create_table(
        "friendships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "friend_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
    )

    # ─── restaurants ───
    op.create_table(
        "restaurants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("place_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column(
            "types", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
        ),
        sa.Column("primary_category", sa.String(100), nullable=False),
        sa.Column("price_level", sa.Integer(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("user_ratings_total", sa.Integer(), nullable=True),
        sa.Column("opening_hours", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("google_maps_url", sa.Text(), nullable=True),
        sa.Column("is_permanent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cache_key", sa.String(200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("place_id", name="uq_restaurants_place_id"),
    )
    op.create_index("ix_restaurants_place_id", "restaurants", ["place_id"])
    op.create_index("ix_restaurants_primary_category", "restaurants", ["primary_category"])
    op.create_index("ix_restaurants_cache_key", "restaurants", ["cache_key"])
    # Backs the bounding-box prefilter used by radius search.
    op.create_index("ix_restaurants_lat_lng", "restaurants", ["latitude", "longitude"])
    # Lets the cleanup cronjob find expired TTL rows cheaply.
    op.create_index(
        "ix_restaurants_is_permanent_expires_at",
        "restaurants",
        ["is_permanent", "expires_at"],
    )

    # ─── sessions ───
    session_status = postgresql.ENUM(
        "lobby", "active", "finished", name="sessionstatus"
    )
    session_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "host_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "lobby", "active", "finished", name="sessionstatus", create_type=False
            ),
            nullable=False,
            server_default="lobby",
        ),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("radius_km", sa.Float(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invite_code", sa.String(50), nullable=False),
        sa.Column("category_filter", sa.String(100), nullable=True),
        sa.Column("price_filter", sa.Integer(), nullable=True),
        sa.Column("rating_filter", sa.Float(), nullable=True),
        sa.Column("open_now_filter", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cache_key", sa.String(200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("invite_code", name="uq_sessions_invite_code"),
    )
    op.create_index("ix_sessions_invite_code", "sessions", ["invite_code"])

    # ─── session_participants ───
    participant_status = postgresql.ENUM(
        "in_lobby", "swiping", "waiting", "disconnected", name="participantstatus"
    )
    participant_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "session_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "in_lobby",
                "swiping",
                "waiting",
                "disconnected",
                name="participantstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="in_lobby",
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("session_id", "user_id", name="uq_session_participant"),
    )

    # ─── session_decks ───
    op.create_table(
        "session_decks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("session_id", "position", name="uq_session_deck_position"),
        sa.UniqueConstraint("session_id", "restaurant_id", name="uq_session_deck_restaurant"),
    )
    op.create_index("ix_session_decks_session_id", "session_decks", ["session_id"])

    # ─── votes ───
    op.create_table(
        "votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("restaurants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("liked", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # NULL session_id rows (solo likes) are exempt from this constraint,
        # since Postgres treats NULLs as distinct in a unique index.
        sa.UniqueConstraint(
            "session_id", "user_id", "restaurant_id", name="uq_vote_once"
        ),
    )
    op.create_index("ix_votes_session_restaurant", "votes", ["session_id", "restaurant_id"])
    op.create_index("ix_votes_session_user", "votes", ["session_id", "user_id"])

    # ─── match_results ───
    resolution_type = postgresql.ENUM(
        "unanimous",
        "majority",
        "spin_wheel_tie",
        "spin_wheel_no_match",
        name="resolutiontype",
    )
    resolution_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "match_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "restaurant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("restaurants.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "resolution_type",
            postgresql.ENUM(
                "unanimous",
                "majority",
                "spin_wheel_tie",
                "spin_wheel_no_match",
                name="resolutiontype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("restaurant_name", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("session_id", name="uq_match_results_session_id"),
    )

    # ─── notifications ───
    notification_type = postgresql.ENUM("session_invite", name="notificationtype")
    notification_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "type",
            postgresql.ENUM("session_invite", name="notificationtype", create_type=False),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("data", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    postgresql.ENUM(name="notificationtype").drop(op.get_bind(), checkfirst=True)

    op.drop_table("match_results")
    postgresql.ENUM(name="resolutiontype").drop(op.get_bind(), checkfirst=True)

    op.drop_table("votes")
    op.drop_table("session_decks")
    op.drop_table("session_participants")
    postgresql.ENUM(name="participantstatus").drop(op.get_bind(), checkfirst=True)

    op.drop_table("sessions")
    postgresql.ENUM(name="sessionstatus").drop(op.get_bind(), checkfirst=True)

    op.drop_table("restaurants")
    op.drop_table("friendships")
    op.drop_table("users")
