import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, get_current_user
from app.core.rate_limit import clear_attempts, enforce_not_locked_out, record_failed_attempt
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    revoke_all_user_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, ThemeUpdate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

ACCESS_TOKEN_MAX_AGE = settings.access_token_expire_minutes * 60
REFRESH_TOKEN_MAX_AGE = settings.refresh_token_expire_days * 24 * 60 * 60


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=access_token,
        max_age=ACCESS_TOKEN_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=refresh_token,
        max_age=REFRESH_TOKEN_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/")


@router.post("/login", response_model=UserOut)
def login(
    payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)
) -> User:
    client_ip = request.client.host if request.client else "unknown"
    enforce_not_locked_out(payload.username, client_ip)

    user = db.query(User).filter(User.username == payload.username).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        record_failed_attempt(payload.username, client_ip)
        logger.info("Failed login attempt for username=%s ip=%s", payload.username, client_ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    clear_attempts(payload.username, client_ip)

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user, db)
    _set_auth_cookies(response, access_token, refresh_token)

    logger.info("User %s (id=%s) logged in", user.username, user.id)
    return user


@router.post("/refresh", response_model=UserOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    raw_refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if raw_refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    result = rotate_refresh_token(raw_refresh_token, db)
    if result is None:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user, new_refresh_token = result
    access_token = create_access_token(user)
    _set_auth_cookies(response, access_token, new_refresh_token)
    return user


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict[str, str]:
    raw_refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if raw_refresh_token is not None:
        revoke_refresh_token(raw_refresh_token, db)
    _clear_auth_cookies(response)
    return {"detail": "Logged out"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    # Force re-login on all other sessions as a safety measure.
    revoke_all_user_tokens(current_user.id, db)
    new_access_token = create_access_token(current_user)
    new_refresh_token = create_refresh_token(current_user, db)
    _set_auth_cookies(response, new_access_token, new_refresh_token)

    logger.info("User %s (id=%s) changed their password", current_user.username, current_user.id)
    return {"detail": "Password changed"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/theme", response_model=UserOut)
def update_theme(
    payload: ThemeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    current_user.theme_preference = payload.theme_preference
    db.commit()
    db.refresh(current_user)
    return current_user
