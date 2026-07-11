from pydantic import BaseModel

from app.models.ticket import TicketStatus


class ProjectSearchResult(BaseModel):
    id: int
    name: str
    description: str


class TicketSearchResult(BaseModel):
    id: int
    number: int
    title: str
    project_id: int
    status: TicketStatus


class UserSearchResult(BaseModel):
    id: int
    username: str
    full_name: str | None


class CommentSearchResult(BaseModel):
    id: int
    ticket_id: int
    project_id: int
    snippet: str


class SearchResults(BaseModel):
    projects: list[ProjectSearchResult]
    tickets: list[TicketSearchResult]
    users: list[UserSearchResult]
    comments: list[CommentSearchResult]
