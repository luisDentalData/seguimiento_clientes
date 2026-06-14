"""create analysts table + seed

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-14

Crea la tabla `analysts` y siembra las 3 analistas actuales.
Carolina Bosom se siembra como INACTIVA (ya no trabaja con nosotros).
"""
from alembic import op
import sqlalchemy as sa

revision = "b7c8d9e0f1a2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysts",
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("email"),
    )
    op.create_index("ix_analysts_email", "analysts", ["email"])
    op.create_index("ix_analysts_is_active", "analysts", ["is_active"])

    # Seed de las analistas actuales (idempotente por PK email).
    analysts = sa.table(
        "analysts",
        sa.column("email", sa.String),
        sa.column("name", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        analysts,
        [
            {"email": "u.barroso@dentaldata.es", "name": "Úrsula Barroso", "is_active": True},
            {"email": "m.val@dentaldata.es", "name": "Marta Val", "is_active": True},
            {"email": "c.bosom@dentaldata.es", "name": "Carolina Bosom", "is_active": False},
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_analysts_is_active", table_name="analysts")
    op.drop_index("ix_analysts_email", table_name="analysts")
    op.drop_table("analysts")
