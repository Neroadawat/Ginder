"""Add opt-in restaurant administration without replacing existing records."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("restaurants", sa.Column("photo_s3_key", sa.Text(), nullable=True))
    op.add_column("restaurants", sa.Column("admin_version", sa.Integer(), server_default="1", nullable=False))
    op.add_column("restaurants", sa.Column("admin_reviewed_at", sa.DateTime(timezone=True)))
    op.add_column("restaurants", sa.Column("admin_notes", sa.Text()))
    op.create_table(
        "admin_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_admin_sessions_user_id", "admin_sessions", ["user_id"])
    op.create_index("ix_admin_sessions_expires_at", "admin_sessions", ["expires_at"])
    op.create_table(
        "restaurant_audits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("changes", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_restaurant_audits_restaurant_id", "restaurant_audits", ["restaurant_id"])


def downgrade() -> None:
    op.drop_table("restaurant_audits")
    op.drop_table("admin_sessions")
    for column in ["admin_notes", "admin_reviewed_at", "admin_version", "photo_s3_key"]:
        op.drop_column("restaurants", column)
    op.drop_column("users", "is_admin")
