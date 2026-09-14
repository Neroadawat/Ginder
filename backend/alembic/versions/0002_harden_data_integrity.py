"""Harden account deletion, cached restaurants, and solo likes.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-12
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Preserve active and finished sessions for the remaining participants
    # when their host account is deleted.
    op.drop_constraint("sessions_host_id_fkey", "sessions", type_="foreignkey")
    op.alter_column("sessions", "host_id", existing_type=sa.Uuid(), nullable=True)
    op.create_foreign_key(
        "sessions_host_id_fkey",
        "sessions",
        "users",
        ["host_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Keep cache cleanup from cascading into persisted decks and votes.
    for table_name in ("session_decks", "votes"):
        constraint_name = f"{table_name}_restaurant_id_fkey"
        op.drop_constraint(constraint_name, table_name, type_="foreignkey")
        op.create_foreign_key(
            constraint_name,
            table_name,
            "restaurants",
            ["restaurant_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    # Keep the oldest copy before enforcing uniqueness on existing databases.
    op.execute(
        """
        DELETE FROM votes
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    row_number() OVER (
                        PARTITION BY user_id, restaurant_id
                        ORDER BY created_at, id
                    ) AS duplicate_number
                FROM votes
                WHERE session_id IS NULL
            ) AS solo_votes
            WHERE duplicate_number > 1
        )
        """
    )
    op.create_index(
        "uq_votes_solo_user_restaurant",
        "votes",
        ["user_id", "restaurant_id"],
        unique=True,
        postgresql_where=sa.text("session_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_votes_solo_user_restaurant", table_name="votes")

    for table_name in ("votes", "session_decks"):
        constraint_name = f"{table_name}_restaurant_id_fkey"
        op.drop_constraint(constraint_name, table_name, type_="foreignkey")
        op.create_foreign_key(
            constraint_name,
            table_name,
            "restaurants",
            ["restaurant_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # A nullable host cannot be represented by the previous schema.
    op.execute("DELETE FROM sessions WHERE host_id IS NULL")
    op.drop_constraint("sessions_host_id_fkey", "sessions", type_="foreignkey")
    op.alter_column("sessions", "host_id", existing_type=sa.Uuid(), nullable=False)
    op.create_foreign_key(
        "sessions_host_id_fkey",
        "sessions",
        "users",
        ["host_id"],
        ["id"],
        ondelete="CASCADE",
    )
