import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.user import User

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user.id), "role": user.role.value, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_refresh_token(user: User, db: Session) -> str:
    raw_token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=expires_at,
        )
    )
    db.commit()
    return raw_token


def rotate_refresh_token(raw_token: str, db: Session) -> tuple[User, str] | None:
    """Validates and rotates a refresh token. Returns (user, new_raw_token) or None if invalid.

    If a token that was already revoked is presented, that indicates possible theft
    (rotation-on-use means a legitimate client would never reuse a revoked token) —
    all of that user's active refresh tokens are revoked as a defensive response.
    """
    token_hash = _hash_token(raw_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if record is None:
        return None

    now = datetime.now(timezone.utc)

    if record.revoked_at is not None:
        _revoke_all_user_tokens(record.user_id, db)
        return None

    if record.expires_at < now:
        return None

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None or not user.is_active:
        return None

    record.revoked_at = now
    db.commit()

    new_raw_token = create_refresh_token(user, db)
    return user, new_raw_token


def revoke_refresh_token(raw_token: str, db: Session) -> None:
    token_hash = _hash_token(raw_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if record is not None and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        db.commit()


def _revoke_all_user_tokens(user_id: int, db: Session) -> None:
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": now})
    db.commit()


def revoke_all_user_tokens(user_id: int, db: Session) -> None:
    _revoke_all_user_tokens(user_id, db)
