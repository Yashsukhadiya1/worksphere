"""notification read receipt

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-06 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("read_by_name", sa.Text(), nullable=True))
    op.add_column("notifications", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    # Track which admin/sender created this notification
    op.add_column("notifications", sa.Column("sent_by_user_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "sent_by_user_id")
    op.drop_column("notifications", "read_at")
    op.drop_column("notifications", "read_by_name")
