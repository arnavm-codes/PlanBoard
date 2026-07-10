from datetime import datetime

from pydantic import BaseModel


class ActivityLogOut(BaseModel):
    id: int
    project_id: int | None
    actor_id: int
    actor_username: str
    action_type: str
    target_type: str
    target_id: int
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}
