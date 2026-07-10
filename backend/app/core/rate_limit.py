import threading
import time

from fastapi import HTTPException, status

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60

_lock = threading.Lock()
_attempts: dict[str, list[float]] = {}


def _key(username: str, client_ip: str) -> str:
    return f"{username.lower()}:{client_ip}"


def enforce_not_locked_out(username: str, client_ip: str) -> None:
    """Raises 429 if the (username, IP) pair has MAX_ATTEMPTS+ recorded failures
    within WINDOW_SECONDS. Call before attempting to validate credentials.
    """
    now = time.monotonic()
    k = _key(username, client_ip)

    with _lock:
        recent = [t for t in _attempts.get(k, []) if now - t < WINDOW_SECONDS]
        _attempts[k] = recent

        if len(recent) >= MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Try again later.",
            )


def record_failed_attempt(username: str, client_ip: str) -> None:
    now = time.monotonic()
    k = _key(username, client_ip)
    with _lock:
        _attempts.setdefault(k, []).append(now)


def clear_attempts(username: str, client_ip: str) -> None:
    _attempts.pop(_key(username, client_ip), None)
