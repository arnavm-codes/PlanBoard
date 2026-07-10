from pydantic import BaseModel, Field

from app.models.user import ThemePreference, UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ThemeUpdate(BaseModel):
    theme_preference: ThemePreference


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: UserRole
    theme_preference: ThemePreference
    is_active: bool

    model_config = {"from_attributes": True}
