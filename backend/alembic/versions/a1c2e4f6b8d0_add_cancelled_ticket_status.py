"""add cancelled ticket status

Revision ID: a1c2e4f6b8d0
Revises: 31f6049e96fc
Create Date: 2026-07-11 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a1c2e4f6b8d0'
down_revision: Union[str, None] = '31f6049e96fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside the transaction Alembic
    # normally wraps migrations in (Postgres forbids using the new value in
    # that same transaction, and pre-12 rejects the statement outright) —
    # autocommit_block() runs this one statement outside it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'cancelled'")


def downgrade() -> None:
    # Postgres has no ALTER TYPE ... DROP VALUE; reverting would require
    # rebuilding the enum type and remapping any 'cancelled' rows first,
    # which isn't a safe automatic downgrade.
    raise NotImplementedError("Cannot drop an enum value in Postgres without a manual data migration")
