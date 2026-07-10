import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user, require_project_member, require_role
from app.database import get_db
from app.models.project import Project
from app.models.project_member import ProjectMember, ProjectMemberRole
from app.models.user import User, UserRole
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailOut,
    ProjectMemberCreate,
    ProjectMemberOut,
    ProjectOut,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)


def _member_out(member: ProjectMember, db: Session) -> ProjectMemberOut:
    user = db.query(User).filter(User.id == member.user_id).first()
    return ProjectMemberOut(
        id=member.id,
        user_id=member.user_id,
        username=user.username if user else "unknown",
        role_in_project=member.role_in_project,
    )


def scoped_projects_query(current_user: User, db: Session):
    """Projects visible to current_user: all of them for superadmin, else only
    projects they have a ProjectMember row for. Returns a SQLAlchemy query
    (not yet executed) so callers can add further filtering/ordering.
    """
    if current_user.role == UserRole.superadmin:
        return db.query(Project)

    return (
        db.query(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == current_user.id)
    )


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(require_role(UserRole.superadmin)),
    db: Session = Depends(get_db),
) -> Project:
    admin_user = db.query(User).filter(User.id == payload.admin_user_id).first()
    if admin_user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="admin_user_id does not exist")

    project = Project(
        name=payload.name,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(project)
    db.flush()

    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=admin_user.id,
            role_in_project=ProjectMemberRole.admin,
        )
    )
    db.flush()
    log_activity(
        db,
        actor=current_user,
        action_type="project_created",
        target_type="project",
        target_id=project.id,
        description=f"{current_user.username} created project '{project.name}'",
        project_id=project.id,
    )
    db.commit()
    db.refresh(project)
    logger.info("Project %s (id=%s) created by user_id=%s", project.name, project.id, current_user.id)
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Project]:
    return scoped_projects_query(current_user, db).order_by(Project.name).all()


@router.get("/{project_id}", response_model=ProjectDetailOut, dependencies=[Depends(require_project_member())])
def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectDetailOut:
    project = db.query(Project).filter(Project.id == project_id).first()
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    return ProjectDetailOut(
        **ProjectOut.model_validate(project).model_dump(),
        members=[_member_out(m, db) for m in members],
    )


@router.patch(
    "/{project_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require_project_member(ProjectMemberRole.admin))],
)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description

    log_activity(
        db,
        actor=current_user,
        action_type="project_updated",
        target_type="project",
        target_id=project.id,
        description=f"{current_user.username} updated project metadata",
        project_id=project.id,
    )
    db.commit()
    db.refresh(project)
    logger.info("Project %s (id=%s) metadata updated", project.name, project.id)
    return project


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_project_member(ProjectMemberRole.admin))],
)
def add_member(
    project_id: int,
    payload: ProjectMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectMemberOut:
    user = db.query(User).filter(User.id == payload.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id does not exist")

    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == payload.user_id)
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this project")

    member = ProjectMember(
        project_id=project_id, user_id=payload.user_id, role_in_project=payload.role_in_project
    )
    db.add(member)
    log_activity(
        db,
        actor=current_user,
        action_type="member_added",
        target_type="user",
        target_id=user.id,
        description=f"{current_user.username} added {user.username} as {payload.role_in_project.value}",
        project_id=project_id,
    )
    db.commit()
    db.refresh(member)
    logger.info("User_id=%s added to project_id=%s as %s", payload.user_id, project_id, payload.role_in_project.value)
    return _member_out(member, db)


@router.delete(
    "/{project_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_project_member(ProjectMemberRole.admin))],
)
def remove_member(
    project_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.role_in_project == ProjectMemberRole.admin:
        other_admins = (
            db.query(ProjectMember)
            .filter(
                ProjectMember.project_id == project_id,
                ProjectMember.role_in_project == ProjectMemberRole.admin,
                ProjectMember.user_id != user_id,
            )
            .count()
        )
        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin of a project",
            )

    removed_user = db.query(User).filter(User.id == user_id).first()
    log_activity(
        db,
        actor=current_user,
        action_type="member_removed",
        target_type="user",
        target_id=user_id,
        description=f"{current_user.username} removed {removed_user.username if removed_user else 'a user'} from the project",
        project_id=project_id,
    )
    db.delete(member)
    db.commit()
    logger.info("User_id=%s removed from project_id=%s", user_id, project_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(require_role(UserRole.superadmin)),
    db: Session = Depends(get_db),
) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project_name = project.name
    # Logged as a system-wide event (project_id omitted) since the project
    # itself is about to stop existing — cascading deletes (tickets,
    # comments, project members) happen at the DB level via ON DELETE
    # CASCADE on their foreign keys; any of that project's activity log
    # entries lose their project_id (ON DELETE SET NULL) but keep their
    # descriptive text.
    log_activity(
        db,
        actor=current_user,
        action_type="project_deleted",
        target_type="project",
        target_id=project_id,
        description=f"{current_user.username} deleted project '{project_name}'",
    )
    db.delete(project)
    db.commit()
    logger.info("Project %s (id=%s) deleted by user_id=%s", project_name, project_id, current_user.id)
