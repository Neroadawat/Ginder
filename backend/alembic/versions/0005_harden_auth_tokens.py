"""Harden authentication tokens and consent records.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("accepted_terms_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), server_default="0", nullable=False),
    )
    op.execute(
        "UPDATE users SET accepted_terms_at = created_at "
        "WHERE accepted_terms = true AND accepted_terms_at IS NULL"
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT lower(trim(email))
                FROM users
                GROUP BY lower(trim(email))
                HAVING count(*) > 1
            ) THEN
                RAISE EXCEPTION
                    'Duplicate user emails differ only by case; resolve them before migration 0005';
            END IF;
        END
        $$
        """
    )
    op.execute("UPDATE users SET email = lower(trim(email))")
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_column("users", "token_version")
    op.drop_column("users", "accepted_terms_at")
