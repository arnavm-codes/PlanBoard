from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.ticket import TicketPriority, TicketStatus


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=20000)
    priority: TicketPriority = TicketPriority.medium
    assignee_id: int | None = None
    due_date: date | None = None


class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assignee_id: int | None = None
    due_date: date | None = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class CommentOut(BaseModel):
    id: int
    ticket_id: int
    author_id: int
    author_username: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    id: int
    project_id: int
    number: int
    title: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    assignee_id: int | None
    reporter_id: int
    due_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketDetailOut(TicketOut):
    comments: list[CommentOut] = []
