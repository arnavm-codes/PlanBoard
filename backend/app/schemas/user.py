from pydantic import BaseModel, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    full_name: str | None = Field(default=None, max_length=128)
    password: str = Field(min_length=8)
    role: UserRole


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserActivationUpdate(BaseModel):
    is_active: bool
