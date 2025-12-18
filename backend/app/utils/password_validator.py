import re
from fastapi import HTTPException, status


def validate_password(password: str) -> None:
    """
    Validate password strength:
    - At least 8 characters
    - Contains uppercase, lowercase, digit, and special character
    """
    if len(password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password too short")

    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain an uppercase letter")

    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain a lowercase letter")

    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain a digit")

    if not re.search(r"[@$!%*?&#]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain a special character")
