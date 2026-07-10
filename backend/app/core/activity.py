from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog
from app.models.user import User


def log_activity(
    db: Session,
    actor: User,
    action_type: str,
    target_type: str,
    target_id: int,
    description: str,
    project_id: int | None = None,
) -> None:
    """Records an activity log entry. Does not commit — call sites already
    commit as part of their existing transaction; this piggybacks on that
    same commit rather than adding a second DB round-trip.
    """
    db.add(
        ActivityLog(
            project_id=project_id,
            actor_id=actor.id,
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            description=description,
        )
    )
