"""clinic_groups table + clients.group_id + seed

Revision ID: c3d4e5f6a7b8
Revises: b7c8d9e0f1a2
Create Date: 2026-06-15

Crea la entidad de grupos de sedes y siembra los 10 grupos que estaban
hardcodeados en src/domain/sync/groups.py, asignando group_id a sus sedes.
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None

# Grupos que estaban en SYNC_GROUPS (config previa) → ahora seed de la DB.
_SEED = {
    "Amelar": ["DD-00018", "DD-00045"],
    "Junyent": ["DD-00078", "DD-00089"],
    "Almidental": ["DD-00008", "DD-00126"],
    "Smilodon": ["DD-00112", "DD-00113"],
    "Garantia": ["DD-00080", "DD-00081"],
    "Maxal": ["DD-00010", "DD-00116"],
    "Triana": ["DD-00014", "DD-00015"],
    "Rull": ["DD-00128", "DD-00129"],
    "Elite": ["DD-00070", "DD-00071", "DD-00072", "DD-00073",
              "DD-00074", "DD-00075", "DD-00076"],
    "Corral&Vargas": ["DD-00145", "DD-00146", "DD-00147"],
}


def upgrade() -> None:
    op.create_table(
        "clinic_groups",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.add_column("clients", sa.Column("group_id", sa.Integer(), nullable=True))
    op.create_index("ix_clients_group_id", "clients", ["group_id"])
    op.create_foreign_key(
        "fk_clients_group_id", "clients", "clinic_groups", ["group_id"], ["id"]
    )

    # Seed: crea cada grupo y asigna group_id a sus sedes existentes.
    conn = op.get_bind()
    for name, members in _SEED.items():
        gid = conn.execute(
            sa.text("INSERT INTO clinic_groups (name) VALUES (:n) RETURNING id"),
            {"n": name},
        ).scalar()
        stmt = sa.text(
            "UPDATE clients SET group_id = :g WHERE id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True))
        conn.execute(stmt, {"g": gid, "ids": members})


def downgrade() -> None:
    op.drop_constraint("fk_clients_group_id", "clients", type_="foreignkey")
    op.drop_index("ix_clients_group_id", table_name="clients")
    op.drop_column("clients", "group_id")
    op.drop_table("clinic_groups")
