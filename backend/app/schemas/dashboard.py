from pydantic import BaseModel

from app.schemas.project import ProjectOut
from app.schemas.ticket import TicketOut


class TicketWithProjectOut(TicketOut):
    project_name: str


class DashboardMeOut(BaseModel):
    assigned_tickets: list[TicketWithProjectOut]
    due_soon_tickets: list[TicketWithProjectOut]
    overdue_count: int
    projects: list[ProjectOut]


class WorkloadEntry(BaseModel):
    user_id: int
    username: str
    ticket_count: int


class ProjectInsight(BaseModel):
    project_id: int
    project_name: str
    counts_by_status: dict[str, int]
    overdue_count: int
    workload: list[WorkloadEntry]


class DashboardInsightsOut(BaseModel):
    projects: list[ProjectInsight]
