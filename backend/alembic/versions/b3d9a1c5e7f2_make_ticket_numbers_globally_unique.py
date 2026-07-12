"""make ticket numbers globally unique

Revision ID: b3d9a1c5e7f2
Revises: a1c2e4f6b8d0
Create Date: 2026-07-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3d9a1c5e7f2'
down_revision: Union[str, None] = 'a1c2e4f6b8d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_ticket_project_number", "tickets", type_="unique")

    op.execute("CREATE SEQUENCE ticket_number_seq")

    conn = op.get_bind()
    ticket_ids = [
        row[0]
        for row in conn.execute(sa.text("SELECT id FROM tickets ORDER BY created_at, id")).fetchall()
    ]
    for ticket_id in ticket_ids:
        conn.execute(
            sa.text("UPDATE tickets SET number = nextval('ticket_number_seq') WHERE id = :tid"),
            {"tid": ticket_id},
        )

    op.alter_column(
        "tickets",
        "number",
        server_default=sa.text("nextval('ticket_number_seq')"),
    )
    op.execute("ALTER SEQUENCE ticket_number_seq OWNED BY tickets.number")
    op.create_unique_constraint("uq_ticket_number", "tickets", ["number"])
    op.drop_column("projects", "next_ticket_number")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("next_ticket_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.drop_constraint("uq_ticket_number", "tickets", type_="unique")
    op.alter_column("tickets", "number", server_default=None)
    op.execute("DROP SEQUENCE IF EXISTS ticket_number_seq")

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

    op.alter_column("projects", "next_ticket_number", server_default=None)
    op.create_unique_constraint("uq_ticket_project_number", "tickets", ["project_id", "number"])
