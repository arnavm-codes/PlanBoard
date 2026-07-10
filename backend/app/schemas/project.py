from datetime import datetime

from pydantic import BaseModel, Field

from app.models.project_member import ProjectMemberRole


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=2000)
    admin_user_id: int


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)


class ProjectMemberCreate(BaseModel):
    user_id: int
    role_in_project: ProjectMemberRole


class ProjectMemberOut(BaseModel):
    id: int
    user_id: int
    username: str
    role_in_project: ProjectMemberRole

    model_config = {"from_attributes": True}


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetailOut(ProjectOut):
    members: list[ProjectMemberOut] = []
