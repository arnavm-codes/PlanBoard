import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.comment import Comment
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.ticket import Ticket
from app.models.user import User, UserRole
from app.routers.projects import scoped_projects_query
from app.schemas.search import CommentSearchResult, ProjectSearchResult, SearchResults, TicketSearchResult, UserSearchResult

router = APIRouter(tags=["search"])
logger = logging.getLogger(__name__)

SEARCH_RESULT_LIMIT = 8
SNIPPET_RADIUS = 40


def _snippet(body: str, term: str) -> str:
    idx = body.lower().find(term.lower())
    if idx == -1:
        return body[: SNIPPET_RADIUS * 2]
    start = max(0, idx - SNIPPET_RADIUS)
    end = min(len(body), idx + len(term) + SNIPPET_RADIUS)
    return f"{'…' if start > 0 else ''}{body[start:end]}{'…' if end < len(body) else ''}"


@router.get("/search", response_model=SearchResults)
def search(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SearchResults:
    term = q.strip()
    empty = SearchResults(projects=[], tickets=[], users=[], comments=[])
    if not term:
        return empty

    like = f"%{term}%"
    visible_project_ids = [
        pid for (pid,) in scoped_projects_query(current_user, db).with_entities(Project.id).all()
    ]
    if not visible_project_ids:
        return empty

    projects = (
        scoped_projects_query(current_user, db)
        .filter(or_(Project.name.ilike(like), Project.description.ilike(like)))
        .order_by(Project.name)
        .limit(SEARCH_RESULT_LIMIT)
        .all()
    )

    # Deliberately title/description text only — never matched against
    # Ticket.number — so typing a numeric string only surfaces tickets whose
    # text happens to contain it, not "ticket #<that number>".
    tickets = (
        db.query(Ticket)
        .filter(
            Ticket.project_id.in_(visible_project_ids),
            or_(Ticket.title.ilike(like), Ticket.description.ilike(like)),
        )
        .order_by(Ticket.updated_at.desc())
        .limit(SEARCH_RESULT_LIMIT)
        .all()
    )

    if current_user.role == UserRole.superadmin:
        users_query = db.query(User).filter(or_(User.username.ilike(like), User.full_name.ilike(like)))
    else:
        users_query = (
            db.query(User)
            .join(ProjectMember, ProjectMember.user_id == User.id)
            .filter(
                ProjectMember.project_id.in_(visible_project_ids),
                or_(User.username.ilike(like), User.full_name.ilike(like)),
            )
            .distinct()
        )
    users = users_query.order_by(User.username).limit(SEARCH_RESULT_LIMIT).all()

    comment_rows = (
        db.query(Comment, Ticket.project_id)
        .join(Ticket, Ticket.id == Comment.ticket_id)
        .filter(Ticket.project_id.in_(visible_project_ids), Comment.body.ilike(like))
        .order_by(Comment.created_at.desc())
        .limit(SEARCH_RESULT_LIMIT)
        .all()
    )

    return SearchResults(
        projects=[ProjectSearchResult(id=p.id, name=p.name, description=p.description) for p in projects],
        tickets=[
            TicketSearchResult(id=t.id, number=t.number, title=t.title, project_id=t.project_id, status=t.status)
            for t in tickets
        ],
        users=[UserSearchResult(id=u.id, username=u.username, full_name=u.full_name) for u in users],
        comments=[
            CommentSearchResult(id=c.id, ticket_id=c.ticket_id, project_id=project_id, snippet=_snippet(c.body, term))
            for c, project_id in comment_rows
        ],
    )
