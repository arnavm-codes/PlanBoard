from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_project_member, require_role
from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.user import User, UserRole
from app.schemas.activity import ActivityLogOut

router = APIRouter(tags=["activity"])

PROJECT_FEED_LIMIT = 50
GLOBAL_FEED_LIMIT = 100


def _log_out(entry: ActivityLog, db: Session) -> ActivityLogOut:
    actor = db.query(User).filter(User.id == entry.actor_id).first()
    return ActivityLogOut(
        id=entry.id,
        project_id=entry.project_id,
        actor_id=entry.actor_id,
        actor_username=actor.username if actor else "unknown",
        action_type=entry.action_type,
        target_type=entry.target_type,
        target_id=entry.target_id,
        description=entry.description,
        created_at=entry.created_at,
    )


@router.get(
    "/projects/{project_id}/activity",
    response_model=list[ActivityLogOut],
    dependencies=[Depends(require_project_member())],
)
def list_project_activity(project_id: int, db: Session = Depends(get_db)) -> list[ActivityLogOut]:
    entries = (
        db.query(ActivityLog)
        .filter(ActivityLog.project_id == project_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(PROJECT_FEED_LIMIT)
        .all()
    )
    return [_log_out(e, db) for e in entries]


@router.get(
    "/activity",
    response_model=list[ActivityLogOut],
    dependencies=[Depends(require_role(UserRole.superadmin))],
)
def list_global_activity(db: Session = Depends(get_db)) -> list[ActivityLogOut]:
    entries = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(GLOBAL_FEED_LIMIT).all()
    return [_log_out(e, db) for e in entries]
