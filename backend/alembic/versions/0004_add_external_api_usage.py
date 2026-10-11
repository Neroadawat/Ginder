"""Add monthly external API usage backup counters.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "external_api_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("operation", sa.String(length=50), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "period",
            "provider",
            "operation",
            name="uq_external_api_usage_period_operation",
        ),
    )
    op.create_index(
        "ix_external_api_usage_period", "external_api_usage", ["period"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_external_api_usage_period", table_name="external_api_usage")
    op.drop_table("external_api_usage")
