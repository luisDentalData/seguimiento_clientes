"""fix client_emails sequence desync

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-06-30

"""
from alembic import op

revision = 'd5e6f7a8b9c0'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "SELECT setval('client_emails_id_seq', GREATEST((SELECT MAX(id) FROM client_emails), 1))"
    )


def downgrade():
    pass
