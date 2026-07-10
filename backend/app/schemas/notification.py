from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    type: str
    message: str
    related_ticket_id: int | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
