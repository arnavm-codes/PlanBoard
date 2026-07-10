import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import sessionmaker

from app.core.notifications import notify_user, push_notification
from app.models.notification import Notification
from app.models.ticket import Ticket, TicketStatus
from app.routers.dashboard import DUE_SOON_WINDOW_DAYS
from app.schemas.notification import NotificationOut

logger = logging.getLogger(__name__)

DUE_DATE_CHECK_INTERVAL_HOURS = 6


def _check_due_dates(session_factory: sessionmaker) -> None:
    db = session_factory()
    try:
        today = date.today()
        cutoff = today + timedelta(days=DUE_SOON_WINDOW_DAYS)
        dedup_window_start = datetime.now(timezone.utc) - timedelta(hours=DUE_DATE_CHECK_INTERVAL_HOURS)

        tickets = (
            db.query(Ticket)
            .filter(
                Ticket.assignee_id.isnot(None),
                Ticket.due_date.isnot(None),
                Ticket.due_date <= cutoff,
                Ticket.status != TicketStatus.done,
            )
            .all()
        )

        for ticket in tickets:
            already_notified = (
                db.query(Notification)
                .filter(
                    Notification.user_id == ticket.assignee_id,
                    Notification.related_ticket_id == ticket.id,
                    Notification.type == "due_date_reminder",
                    Notification.created_at >= dedup_window_start,
                )
                .first()
            )
            if already_notified is not None:
                continue

            verb = "is overdue" if ticket.due_date < today else "is due soon"
            notification = notify_user(
                db,
                user_id=ticket.assignee_id,
                type_="due_date_reminder",
                message=f"Ticket '{ticket.title}' {verb} ({ticket.due_date.isoformat()})",
                related_ticket_id=ticket.id,
            )
            db.commit()
            push_notification(
                ticket.assignee_id,
                NotificationOut.model_validate(notification).model_dump(mode="json"),
            )
    except Exception:
        logger.exception("Due-date check failed")
        db.rollback()
    finally:
        db.close()


async def run_due_date_check(session_factory: sessionmaker) -> None:
    while True:
        await asyncio.to_thread(_check_due_dates, session_factory)
        await asyncio.sleep(DUE_DATE_CHECK_INTERVAL_HOURS * 60 * 60)
