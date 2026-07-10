"""add per-project ticket numbering

Revision ID: 0452f3b0d67b
Revises: 78c0ffd21acb
Create Date: 2026-07-10 17:44:43.268559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0452f3b0d67b'
down_revision: Union[str, None] = '78c0ffd21acb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("next_ticket_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("tickets", sa.Column("number", sa.Integer(), nullable=True))

    conn = op.get_bind()

    project_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM projects")).fetchall()]
    for project_id in project_ids:
        ticket_ids = [
            row[0]
            for row in conn.execute(
                sa.text("SELECT id FROM tickets WHERE project_id = :pid ORDER BY created_at"),
                {"pid": project_id},
            ).fetchall()
        ]
        for i, ticket_id in enumerate(ticket_ids, start=1):
            conn.execute(
                sa.text("UPDATE tickets SET number = :num WHERE id = :tid"),
                {"num": i, "tid": ticket_id},
            )
        conn.execute(
            sa.text("UPDATE projects SET next_ticket_number = :next WHERE id = :pid"),
            {"next": len(ticket_ids) + 1, "pid": project_id},
        )

    op.alter_column("tickets", "number", nullable=False)
    op.create_unique_constraint("uq_ticket_project_number", "tickets", ["project_id", "number"])
    op.alter_column("projects", "next_ticket_number", server_default=None)


def downgrade() -> None:
    op.drop_constraint("uq_ticket_project_number", "tickets", type_="unique")
    op.drop_column("tickets", "number")
    op.drop_column("projects", "next_ticket_number")
