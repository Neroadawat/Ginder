"""Allow ID-only Google restaurant references for party votes."""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_restaurants_source", "restaurants", type_="check")
    op.create_check_constraint(
        "ck_restaurants_source", "restaurants",
        "source IN ('osm', 'manual', 'synthetic', 'google_live')",
    )


def downgrade() -> None:
    # PostgreSQL refuses this downgrade once a party references a Google ID.
    op.drop_constraint("ck_restaurants_source", "restaurants", type_="check")
    op.create_check_constraint(
        "ck_restaurants_source", "restaurants", "source IN ('osm', 'manual', 'synthetic')"
    )
