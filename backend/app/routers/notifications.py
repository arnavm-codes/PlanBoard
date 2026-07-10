import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.deps import ACCESS_TOKEN_COOKIE, get_current_user
from app.core.notifications import manager
from app.core.security import decode_access_token
from app.database import SessionLocal, get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut

router = APIRouter(tags=["notifications"])
logger = logging.getLogger(__name__)

NOTIFICATION_LIST_LIMIT = 50


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(NOTIFICATION_LIST_LIMIT)
        .all()
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/notifications/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict[str, str]:
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()
    return {"detail": "All notifications marked as read"}


@router.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket) -> None:
    raw_token = websocket.cookies.get(ACCESS_TOKEN_COOKIE)
    payload = decode_access_token(raw_token) if raw_token else None

    user = None
    if payload is not None:
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == int(payload["sub"])).first()
        finally:
            db.close()

    if user is None or not user.is_active:
        # Accept first, then close with a distinguishable code — closing
        # before accept() makes the ASGI server reject the handshake at the
        # HTTP level (a generic connection error to the client) instead of
        # delivering a WS close frame the client can actually inspect.
        await websocket.accept()
        await websocket.close(code=4401)
        return

    await websocket.accept()
    manager.connect(user.id, websocket)
    try:
        while True:
            # We don't expect the client to send anything meaningful; this
            # just blocks until the connection closes, which is how we
            # detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, websocket)
