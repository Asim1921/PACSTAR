from datetime import datetime, timedelta
from typing import Optional
import warnings
from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

# Suppress bcrypt version warning (harmless, but noisy)
warnings.filterwarnings('ignore', message='.*bcrypt.*__about__.*', category=UserWarning)

# bcrypt for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# -----------------------------
# Password Handling
# -----------------------------
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(password, hashed)


# -----------------------------
# JWT Handling
# -----------------------------
def create_access_token(subject: str, expires_delta: Optional[int] = None) -> str:
    """Generate a short-lived JWT access token."""
    expire = datetime.utcnow() + timedelta(
        minutes=expires_delta or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def create_refresh_token(subject: str, expires_delta: Optional[int] = None) -> str:
    """Generate a refresh token with rotation policy."""
    expire = datetime.utcnow() + timedelta(
        minutes=expires_delta or settings.REFRESH_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET_KEY, algorithm="HS256")


def decode_token(token: str, refresh: bool = False) -> Optional[str]:
    """Decode JWT and return subject if valid, else None."""
    secret = settings.JWT_REFRESH_SECRET_KEY if refresh else settings.JWT_SECRET_KEY
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None
