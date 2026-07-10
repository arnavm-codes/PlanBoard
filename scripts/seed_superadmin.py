"""Creates the first superadmin account, reading credentials from
SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD in the environment (.env).

Idempotent: does nothing if a superadmin already exists.

Usage (from the backend container, which has the `app` package installed):
    docker compose exec backend python /scripts/seed_superadmin.py
"""

import sys

from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import User, UserRole


def main() -> None:
    if not settings.superadmin_username or not settings.superadmin_password:
        print(
            "SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set in .env "
            "before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(settings.superadmin_password) < 8:
        print("SUPERADMIN_PASSWORD must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        existing_superadmin = db.query(User).filter(User.role == UserRole.superadmin).first()
        if existing_superadmin is not None:
            print(f"Superadmin already exists: {existing_superadmin.username}. Nothing to do.")
            return

        existing_username = db.query(User).filter(User.username == settings.superadmin_username).first()
        if existing_username is not None:
            print(
                f"A user named '{settings.superadmin_username}' already exists with role "
                f"'{existing_username.role.value}'. Refusing to overwrite.",
                file=sys.stderr,
            )
            sys.exit(1)

        user = User(
            username=settings.superadmin_username,
            password_hash=hash_password(settings.superadmin_password),
            role=UserRole.superadmin,
        )
        db.add(user)
        db.commit()
        print(f"Created superadmin '{user.username}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
