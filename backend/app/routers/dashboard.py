from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.project import Project
from app.models.project_member import ProjectMember, ProjectMemberRole
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User, UserRole
from app.routers.activity import _log_out
from app.routers.projects import scoped_projects_query
from app.schemas.activity import ActivityLogOut
from app.schemas.dashboard import (
    DashboardInsightsOut,
    DashboardMeOut,
    ProjectInsight,
    TicketWithProjectOut,
    WorkloadEntry,
)
from app.schemas.project import ProjectOut
from app.schemas.ticket import TicketOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DUE_SOON_WINDOW_DAYS = 3
DASHBOARD_ACTIVITY_LIMIT = 20


def _with_project(ticket: Ticket, project: Project) -> TicketWithProjectOut:
    return TicketWithProjectOut(
        **TicketOut.model_validate(ticket).model_dump(),
        project_name=project.name,
    )


@router.get("/me", response_model=DashboardMeOut)
def get_my_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DashboardMeOut:
    today = date.today()

    open_assigned = (
        db.query(Ticket)
        .filter(
            Ticket.assignee_id == current_user.id,
            Ticket.status.notin_([TicketStatus.done, TicketStatus.cancelled]),
        )
        .join(Project, Project.id == Ticket.project_id)
        .order_by(Ticket.due_date.is_(None), Ticket.due_date)
        .all()
    )

    projects_by_id = {p.id: p for p in db.query(Project).filter(
        Project.id.in_([t.project_id for t in open_assigned])
    ).all()}

    assigned_out = [_with_project(t, projects_by_id[t.project_id]) for t in open_assigned]

    due_soon_cutoff = today + timedelta(days=DUE_SOON_WINDOW_DAYS)
    due_soon_out = [
        t for t in assigned_out if t.due_date is not None and t.due_date <= due_soon_cutoff
    ]
    overdue_count = sum(1 for t in assigned_out if t.due_date is not None and t.due_date < today)

    projects = scoped_projects_query(current_user, db).order_by(Project.name).all()

    return DashboardMeOut(
        assigned_tickets=assigned_out,
        due_soon_tickets=due_soon_out,
        overdue_count=overdue_count,
        projects=[ProjectOut.model_validate(p) for p in projects],
    )


@router.get("/insights", response_model=DashboardInsightsOut)
def get_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DashboardInsightsOut:
    if current_user.role == UserRole.superadmin:
        projects = db.query(Project).order_by(Project.name).all()
    elif current_user.role == UserRole.admin:
        projects = (
            db.query(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .filter(
                ProjectMember.user_id == current_user.id,
                ProjectMember.role_in_project == ProjectMemberRole.admin,
            )
            .order_by(Project.name)
            .all()
        )
    else:
        projects = []

    today = date.today()
    insights: list[ProjectInsight] = []

    for project in projects:
        status_rows = (
            db.query(Ticket.status, func.count(Ticket.id))
            .filter(Ticket.project_id == project.id)
            .group_by(Ticket.status)
            .all()
        )
        counts_by_status = {s.value: c for s, c in status_rows}

        overdue_count = (
            db.query(Ticket)
            .filter(
                Ticket.project_id == project.id,
                Ticket.due_date.isnot(None),
                Ticket.due_date < today,
                Ticket.status.notin_([TicketStatus.done, TicketStatus.cancelled]),
            )
            .count()
        )

        workload_rows = (
            db.query(Ticket.assignee_id, func.count(Ticket.id))
            .filter(
                Ticket.project_id == project.id,
                Ticket.assignee_id.isnot(None),
                Ticket.status.notin_([TicketStatus.done, TicketStatus.cancelled]),
            )
            .group_by(Ticket.assignee_id)
            .all()
        )
        users_by_id = {
            u.id: u for u in db.query(User).filter(User.id.in_([uid for uid, _ in workload_rows])).all()
        }
        workload = [
            WorkloadEntry(user_id=uid, username=users_by_id[uid].username, ticket_count=count)
            for uid, count in workload_rows
            if uid in users_by_id
        ]

        insights.append(
            ProjectInsight(
                project_id=project.id,
                project_name=project.name,
                counts_by_status=counts_by_status,
                overdue_count=overdue_count,
                workload=workload,
            )
        )

    return DashboardInsightsOut(projects=insights)


@router.get("/activity", response_model=list[ActivityLogOut])
def get_dashboard_activity(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ActivityLogOut]:
    if current_user.role == UserRole.superadmin:
        entries = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(DASHBOARD_ACTIVITY_LIMIT).all()
    else:
        project_ids = [p.id for p in scoped_projects_query(current_user, db).all()]
        entries = (
            db.query(ActivityLog)
            .filter(ActivityLog.project_id.in_(project_ids))
            .order_by(ActivityLog.created_at.desc())
            .limit(DASHBOARD_ACTIVITY_LIMIT)
            .all()
        )
    return [_log_out(e, db) for e in entries]
