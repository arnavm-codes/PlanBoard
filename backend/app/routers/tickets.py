import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import TicketAccess, require_project_member, require_ticket_access
from app.core.notifications import notify_user, push_notification
from app.database import get_db
from app.models.comment import Comment
from app.models.project import Project
from app.models.project_member import ProjectMember, ProjectMemberRole
from app.models.ticket import Ticket, TicketPriority, TicketStatus
from app.models.user import User, UserRole
from app.schemas.notification import NotificationOut
from app.schemas.ticket import CommentCreate, CommentOut, TicketCreate, TicketDetailOut, TicketOut, TicketUpdate

router = APIRouter(tags=["tickets"])
logger = logging.getLogger(__name__)


def _ensure_project_member(db: Session, project_id: int, user_id: int, actor: User) -> None:
    """If actor is superadmin and the given user isn't yet a member of the
    project, adds them as a worker. Lets a superadmin assign a ticket to any
    worker system-wide in one step, while keeping the invariant that an
    assignee is always a real project member (so they can still view their
    own ticket — GET /tickets/{id} requires project membership).
    """
    if actor.role != UserRole.superadmin:
        return

    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if existing is not None:
        return

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return

    db.add(ProjectMember(project_id=project_id, user_id=user_id, role_in_project=ProjectMemberRole.worker))
    log_activity(
        db,
        actor=actor,
        action_type="member_added",
        target_type="user",
        target_id=user_id,
        description=f"{actor.username} added {user.username} as worker (auto-added via ticket assignment)",
        project_id=project_id,
    )


def _comment_out(comment: Comment, db: Session) -> CommentOut:
    author = db.query(User).filter(User.id == comment.author_id).first()
    return CommentOut(
        id=comment.id,
        ticket_id=comment.ticket_id,
        author_id=comment.author_id,
        author_username=author.username if author else "unknown",
        body=comment.body,
        created_at=comment.created_at,
    )


@router.post(
    "/projects/{project_id}/tickets",
    response_model=TicketOut,
    status_code=status.HTTP_201_CREATED,
)
def create_ticket(
    project_id: int,
    payload: TicketCreate,
    current_user: User = Depends(require_project_member()),
    db: Session = Depends(get_db),
) -> Ticket:
    # Lock the project row so concurrent ticket creations in the same project
    # can't race to the same ticket number.
    project = db.query(Project).filter(Project.id == project_id).with_for_update().first()
    ticket_number = project.next_ticket_number
    project.next_ticket_number += 1

    if payload.assignee_id is not None:
        _ensure_project_member(db, project_id, payload.assignee_id, current_user)

    ticket = Ticket(
        project_id=project_id,
        number=ticket_number,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        assignee_id=payload.assignee_id,
        reporter_id=current_user.id,
        due_date=payload.due_date,
    )
    db.add(ticket)
    db.flush()
    log_activity(
        db,
        actor=current_user,
        action_type="ticket_created",
        target_type="ticket",
        target_id=ticket.id,
        description=f"{current_user.username} created ticket '{ticket.title}'",
        project_id=project_id,
    )
    db.commit()
    db.refresh(ticket)
    logger.info("Ticket %s created in project_id=%s by user_id=%s", ticket.id, project_id, current_user.id)
    return ticket


@router.get(
    "/projects/{project_id}/tickets",
    response_model=list[TicketOut],
    dependencies=[Depends(require_project_member())],
)
def list_tickets(
    project_id: int,
    status_filter: TicketStatus | None = Query(default=None, alias="status"),
    priority: TicketPriority | None = Query(default=None),
    assignee_id: int | None = Query(default=None),
    due_before: date | None = Query(default=None),
    due_after: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Ticket]:
    q = db.query(Ticket).filter(Ticket.project_id == project_id)
    if status_filter is not None:
        q = q.filter(Ticket.status == status_filter)
    if priority is not None:
        q = q.filter(Ticket.priority == priority)
    if assignee_id is not None:
        q = q.filter(Ticket.assignee_id == assignee_id)
    if due_before is not None:
        q = q.filter(Ticket.due_date <= due_before)
    if due_after is not None:
        q = q.filter(Ticket.due_date >= due_after)
    return q.order_by(Ticket.created_at).all()


@router.get("/tickets/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(access: TicketAccess = Depends(require_ticket_access()), db: Session = Depends(get_db)) -> TicketDetailOut:
    comments = db.query(Comment).filter(Comment.ticket_id == access.ticket.id).order_by(Comment.created_at).all()
    return TicketDetailOut(
        **TicketOut.model_validate(access.ticket).model_dump(),
        comments=[_comment_out(c, db) for c in comments],
    )


@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
def update_ticket(
    payload: TicketUpdate,
    access: TicketAccess = Depends(require_ticket_access()),
    db: Session = Depends(get_db),
) -> Ticket:
    ticket = access.ticket
    is_owner = access.current_user.id in (ticket.reporter_id, ticket.assignee_id)
    if not access.is_project_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project admins or this ticket's reporter/assignee can edit it",
        )

    update_data = payload.model_dump(exclude_unset=True)
    old_status = ticket.status
    old_assignee_id = ticket.assignee_id

    if update_data.get("assignee_id") is not None:
        _ensure_project_member(db, ticket.project_id, update_data["assignee_id"], access.current_user)

    for field, value in update_data.items():
        setattr(ticket, field, value)

    if "status" in update_data and update_data["status"] != old_status:
        description = (
            f"{access.current_user.username} moved ticket '{ticket.title}' "
            f"from {old_status.value} to {ticket.status.value}"
        )
        action_type = "ticket_moved"
    else:
        description = f"{access.current_user.username} updated ticket '{ticket.title}'"
        action_type = "ticket_updated"

    log_activity(
        db,
        actor=access.current_user,
        action_type=action_type,
        target_type="ticket",
        target_id=ticket.id,
        description=description,
        project_id=ticket.project_id,
    )

    pending_notifications = []

    if (
        "assignee_id" in update_data
        and ticket.assignee_id is not None
        and ticket.assignee_id != old_assignee_id
        and ticket.assignee_id != access.current_user.id
    ):
        pending_notifications.append(
            notify_user(
                db,
                user_id=ticket.assignee_id,
                type_="ticket_assigned",
                message=f"You were assigned to ticket '{ticket.title}'",
                related_ticket_id=ticket.id,
            )
        )

    if "status" in update_data and update_data["status"] != old_status:
        recipients = {ticket.assignee_id, ticket.reporter_id} - {None, access.current_user.id}
        for recipient_id in recipients:
            pending_notifications.append(
                notify_user(
                    db,
                    user_id=recipient_id,
                    type_="ticket_status_changed",
                    message=f"Ticket '{ticket.title}' moved to {ticket.status.value}",
                    related_ticket_id=ticket.id,
                )
            )

    db.commit()
    db.refresh(ticket)

    for notification in pending_notifications:
        push_notification(
            notification.user_id, NotificationOut.model_validate(notification).model_dump(mode="json")
        )

    logger.info("Ticket %s updated by user_id=%s: %s", ticket.id, access.current_user.id, list(update_data.keys()))
    return ticket


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    access: TicketAccess = Depends(require_ticket_access(ProjectMemberRole.admin)), db: Session = Depends(get_db)
) -> None:
    ticket_id = access.ticket.id
    log_activity(
        db,
        actor=access.current_user,
        action_type="ticket_deleted",
        target_type="ticket",
        target_id=ticket_id,
        description=f"{access.current_user.username} deleted ticket '{access.ticket.title}'",
        project_id=access.ticket.project_id,
    )
    db.delete(access.ticket)
    db.commit()
    logger.info("Ticket %s deleted by user_id=%s", ticket_id, access.current_user.id)


@router.post("/tickets/{ticket_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    payload: CommentCreate,
    access: TicketAccess = Depends(require_ticket_access()),
    db: Session = Depends(get_db),
) -> CommentOut:
    comment = Comment(ticket_id=access.ticket.id, author_id=access.current_user.id, body=payload.body)
    db.add(comment)
    db.flush()
    log_activity(
        db,
        actor=access.current_user,
        action_type="comment_added",
        target_type="ticket",
        target_id=access.ticket.id,
        description=f"{access.current_user.username} commented on ticket '{access.ticket.title}'",
        project_id=access.ticket.project_id,
    )

    recipients = {access.ticket.assignee_id, access.ticket.reporter_id} - {None, access.current_user.id}
    pending_notifications = [
        notify_user(
            db,
            user_id=recipient_id,
            type_="comment_added",
            message=f"{access.current_user.username} commented on ticket '{access.ticket.title}'",
            related_ticket_id=access.ticket.id,
        )
        for recipient_id in recipients
    ]

    db.commit()
    db.refresh(comment)

    for notification in pending_notifications:
        push_notification(
            notification.user_id, NotificationOut.model_validate(notification).model_dump(mode="json")
        )

    logger.info("Comment added to ticket %s by user_id=%s", access.ticket.id, access.current_user.id)
    return _comment_out(comment, db)
