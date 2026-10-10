"""Add provider-neutral restaurant source metadata.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-09
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("restaurants", sa.Column("source", sa.String(length=30), nullable=True))
    op.add_column("restaurants", sa.Column("source_place_id", sa.String(length=255), nullable=True))
    op.add_column("restaurants", sa.Column("photo_source", sa.String(length=30), nullable=True))
    op.add_column("restaurants", sa.Column("photo_attribution", sa.Text(), nullable=True))
    op.add_column(
        "restaurants", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True)
    )

    # Existing rows already encode their origin in place_id. Unknown legacy
    # prefixes become manual records so they remain usable and reviewable.
    op.execute(
        """
        UPDATE restaurants
        SET
            source = CASE
                WHEN place_id LIKE 'osm:%' THEN 'osm'
                WHEN place_id LIKE 'synthetic:%' THEN 'synthetic'
                WHEN place_id LIKE 'manual:%' THEN 'manual'
                ELSE 'manual'
            END,
            source_place_id = CASE
                WHEN place_id LIKE 'osm:%'
                  OR place_id LIKE 'synthetic:%'
                  OR place_id LIKE 'manual:%'
                THEN split_part(place_id, ':', 2)
                ELSE place_id
            END,
            photo_source = CASE
                WHEN photo_url IS NOT NULL THEN 'external_url'
                ELSE NULL
            END,
            verified_at = CASE
                WHEN place_id LIKE 'synthetic:%' THEN NULL
                ELSE updated_at
            END
        """
    )

    op.alter_column("restaurants", "source", nullable=False)
    op.alter_column("restaurants", "source_place_id", nullable=False)
    op.create_index("ix_restaurants_source", "restaurants", ["source"], unique=False)
    op.create_unique_constraint(
        "uq_restaurants_source_place_id",
        "restaurants",
        ["source", "source_place_id"],
    )
    op.create_check_constraint(
        "ck_restaurants_source",
        "restaurants",
        "source IN ('osm', 'manual', 'synthetic')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_restaurants_source", "restaurants", type_="check")
    op.drop_constraint("uq_restaurants_source_place_id", "restaurants", type_="unique")
    op.drop_index("ix_restaurants_source", table_name="restaurants")
    op.drop_column("restaurants", "verified_at")
    op.drop_column("restaurants", "photo_attribution")
    op.drop_column("restaurants", "photo_source")
    op.drop_column("restaurants", "source_place_id")
    op.drop_column("restaurants", "source")
