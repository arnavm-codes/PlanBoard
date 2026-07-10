import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user, require_role
from app.core.security import hash_password, revoke_all_user_tokens
from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.refresh_token import RefreshToken
from app.models.ticket import Ticket
from app.models.user import User, UserRole
from app.schemas.auth import UserOut
from app.schemas.user import UserActivationUpdate, UserCreate, UserRoleUpdate

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_role(UserRole.superadmin))])
logger = logging.getLogger(__name__)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()
    log_activity(
        db,
        actor=current_user,
        action_type="user_created",
        target_type="user",
        target_id=user.id,
        description=f"{current_user.username} created user account '{user.username}' (role={user.role.value})",
    )
    db.commit()
    db.refresh(user)
    logger.info("User %s (id=%s) created with role=%s", user.username, user.id, user.role.value)
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return db.query(User).order_by(User.username).all()


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = payload.role
    log_activity(
        db,
        actor=current_user,
        action_type="user_role_changed",
        target_type="user",
        target_id=user.id,
        description=f"{current_user.username} changed {user.username}'s role to {user.role.value}",
    )
    db.commit()
    db.refresh(user)
    logger.info("User %s (id=%s) role changed to %s", user.username, user.id, user.role.value)
    return user


@router.patch("/{user_id}/activation", response_model=UserOut)
def update_user_activation(
    user_id: int,
    payload: UserActivationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = payload.is_active
    action = "reactivated" if payload.is_active else "deactivated"
    log_activity(
        db,
        actor=current_user,
        action_type="user_activation_changed",
        target_type="user",
        target_id=user.id,
        description=f"{current_user.username} {action} user '{user.username}'",
    )
    db.commit()

    if not payload.is_active:
        revoke_all_user_tokens(user.id, db)

    db.refresh(user)
    logger.info("User %s (id=%s) is_active set to %s", user.username, user.id, user.is_active)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    ticket_count = (
        db.query(Ticket)
        .filter((Ticket.reporter_id == user_id) | (Ticket.assignee_id == user_id))
        .count()
    )
    comment_count = db.query(Comment).filter(Comment.author_id == user_id).count()
    activity_count = db.query(ActivityLog).filter(ActivityLog.actor_id == user_id).count()
    project_count = db.query(Project).filter(Project.created_by == user_id).count()

    if ticket_count or comment_count or activity_count or project_count:
        parts = []
        if ticket_count:
            parts.append(f"{ticket_count} ticket(s)")
        if comment_count:
            parts.append(f"{comment_count} comment(s)")
        if activity_count:
            parts.append(f"{activity_count} activity log entr(y/ies)")
        if project_count:
            parts.append(f"{project_count} project(s) created")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete user with existing history ({', '.join(parts)}) — deactivate instead.",
        )

    username = user.username
    log_activity(
        db,
        actor=current_user,
        action_type="user_deleted",
        target_type="user",
        target_id=user_id,
        description=f"{current_user.username} deleted user '{username}'",
    )

    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
    db.query(ProjectMember).filter(ProjectMember.user_id == user_id).delete()
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    logger.info("User %s (id=%s) deleted by user_id=%s", username, user_id, current_user.id)
