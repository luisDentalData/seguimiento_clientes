"""add category to appointments

Revision ID: a1b2c3d4e5f6
Revises: 03d2c807e4fc
Create Date: 2026-06-14

Agrega la columna `category` (taxonomía rica de reuniones) a appointments.
Aditiva y nullable: las filas existentes quedan en NULL hasta el próximo ETL.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "03d2c807e4fc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("category", sa.String(), nullable=True))
    op.create_index(
        "ix_appointments_category", "appointments", ["category"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_appointments_category", table_name="appointments")
    op.drop_column("appointments", "category")
