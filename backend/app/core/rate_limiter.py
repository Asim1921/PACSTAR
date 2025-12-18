import time
from collections import defaultdict
from fastapi import Request, HTTPException, status
from app.core.config import settings

# In-memory tracking (replace with Redis for distributed production)
failed_attempts = defaultdict(list)  # key: (username, ip) → list of timestamps
locked_accounts = {}  # key: username → unlock time (epoch)


def is_locked(username: str) -> bool:
    """Check if a user account is locked."""
    # Skip lockout check for master user
    from app.core.config import settings
    if username == settings.MASTER_ADMIN_USERNAME or username == "master":
        # Clear any existing locks for master user
        if username in locked_accounts:
            del locked_accounts[username]
        # Clear any failed attempts for master user
        for key in list(failed_attempts.keys()):
            if key[0] == username:
                del failed_attempts[key]
        return False
    
    if username in locked_accounts:
        unlock_time = locked_accounts[username]
        if time.time() < unlock_time:
            return True
        else:
            # Auto-unlock after lock period expires
            del locked_accounts[username]
    return False


def register_failed_attempt(username: str, client_ip: str):
    """Track failed login attempts and lock account if threshold exceeded."""
    # Skip rate limiting for master user
    if username == settings.MASTER_ADMIN_USERNAME or username == "master":
        return
    
    now = time.time()
    key = (username, client_ip)

    # Append current attempt
    failed_attempts[key].append(now)

    # Keep only attempts within RATE_LIMIT_WINDOW
    window_attempts = [
        t for t in failed_attempts[key] if now - t < settings.RATE_LIMIT_WINDOW
    ]
    failed_attempts[key] = window_attempts

    # Lock account if threshold exceeded
    if len(window_attempts) >= settings.MAX_FAILED_LOGINS:
        locked_accounts[username] = now + (settings.LOCKOUT_TIME_MINUTES * 60)


def reset_attempts(username: str, client_ip: str):
    """Clear failed login attempts after success."""
    key = (username, client_ip)
    if key in failed_attempts:
        del failed_attempts[key]


async def rate_limit_dependency(request: Request):
    """
    FastAPI dependency for login endpoints.
    Applies brute force protection: rate limits, account locks, IP checks.
    Master user bypasses all rate limiting.
    """
    username = request.query_params.get("username", "")
    client_ip = request.client.host if request.client else "unknown"

    # Skip rate limiting for master user
    if username == settings.MASTER_ADMIN_USERNAME or username == "master":
        return

    if username and is_locked(username):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked. Try again in {settings.LOCKOUT_TIME_MINUTES} minutes.",
        )
