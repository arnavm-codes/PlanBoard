from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from dataclasses import dataclass

from app.core.security import decode_access_token
from app.database import get_db
from app.models.project import Project
from app.models.project_member import ProjectMember, ProjectMemberRole
from app.models.ticket import Ticket
from app.models.user import User, UserRole

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    raw_token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if raw_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(raw_token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return user


def require_role(*roles: UserRole):
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _dependency


def require_project_member(*roles_in_project: ProjectMemberRole):
    """Dependency factory for routes with a {project_id} path param.

    Superadmins always pass. Otherwise, requires a ProjectMember row for
    (project_id, current_user) whose role_in_project is in roles_in_project (or
    any role, if none given). Returns 404 (not 403) when the project doesn't
    exist or the user isn't a member, so non-members can't tell project IDs
    apart from ones that simply don't exist.
    """

    def _dependency(
        project_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if current_user.role == UserRole.superadmin:
            return current_user

        membership = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id)
            .first()
        )
        if membership is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        if roles_in_project and membership.role_in_project not in roles_in_project:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        return current_user

    return _dependency


@dataclass
class TicketAccess:
    ticket: Ticket
    current_user: User
    is_project_admin: bool  # True for superadmin or this project's admin-role member


def require_ticket_access(*roles_in_project: ProjectMemberRole):
    """Dependency factory for routes with a {ticket_id} path param.

    Same membership rules as require_project_member, but resolves the project
    via the ticket's project_id instead of a {project_id} path param, and
    returns the loaded Ticket (avoiding a second query in the route body).
    """

    def _dependency(
        ticket_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> TicketAccess:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if ticket is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

        if current_user.role == UserRole.superadmin:
            return TicketAccess(ticket=ticket, current_user=current_user, is_project_admin=True)

        membership = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == ticket.project_id, ProjectMember.user_id == current_user.id)
            .first()
        )
        if membership is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

        if roles_in_project and membership.role_in_project not in roles_in_project:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        return TicketAccess(
            ticket=ticket,
            current_user=current_user,
            is_project_admin=membership.role_in_project == ProjectMemberRole.admin,
        )

    return _dependency
