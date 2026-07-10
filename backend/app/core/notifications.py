import asyncio
import logging

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.models.notification import Notification

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}

    def connect(self, user_id: int, websocket: WebSocket) -> None:
        self._connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(user_id)
        if connections is not None:
            connections.discard(websocket)
            if not connections:
                self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        for ws in list(self._connections.get(user_id, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(user_id, ws)


manager = ConnectionManager()

_event_loop: asyncio.AbstractEventLoop | None = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _event_loop
    _event_loop = loop


def push_notification(user_id: int, payload: dict) -> None:
    """Fire-and-forget real-time push from a sync context. The DB row is the
    source of truth; a client that's offline (or if this no-ops because no
    loop is registered, e.g. in a test) just sees it on the next
    GET /notifications instead.
    """
    if _event_loop is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(manager.send_to_user(user_id, payload), _event_loop)
    except Exception:
        logger.exception("Failed to schedule notification push for user_id=%s", user_id)


def notify_user(
    db: Session,
    user_id: int,
    type_: str,
    message: str,
    related_ticket_id: int | None = None,
) -> Notification:
    """Adds + flushes a Notification row. Does not commit — the caller
    commits as part of its existing transaction, same pattern as
    log_activity. Caller is responsible for calling push_notification with
    the result after commit succeeds.
    """
    notification = Notification(
        user_id=user_id,
        type=type_,
        message=message,
        related_ticket_id=related_ticket_id,
    )
    db.add(notification)
    db.flush()
    return notification
