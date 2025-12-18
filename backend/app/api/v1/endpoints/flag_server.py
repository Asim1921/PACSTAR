from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.flag_server_service import flag_server_service

router = APIRouter(prefix="/flag-server", tags=["flag-server"])
security = HTTPBearer(auto_error=False)


class RegisterKeyRequest(BaseModel):
    challenge_id: str = Field(..., description="Challenge ID")
    team_id: str = Field(..., description="Team identifier")
    flag_name: str = Field(default="default", description="Flag name (for multi-flag)")
    public_key: str = Field(..., description="PEM-encoded RSA public key")


class EncryptedFlagRequest(BaseModel):
    challenge_id: str = Field(..., description="Challenge ID")
    team_id: str = Field(..., description="Team identifier")
    flag_name: str = Field(default="default", description="Flag name (for multi-flag)")
    server_token: str | None = Field(None, description="Pre-shared token for server-to-server auth")


@router.post("/register-public-key")
async def register_public_key(payload: RegisterKeyRequest, creds: HTTPAuthorizationCredentials = Depends(security)):
    """Register a challenge instance public key used for encrypting flags."""
    provided_token = None
    if creds and creds.scheme.lower() == "bearer":
        provided_token = creds.credentials
    if provided_token is None and settings.FLAG_SERVER_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing server token")
    if settings.FLAG_SERVER_TOKEN and provided_token != settings.FLAG_SERVER_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid server token")

    flag_server_service.register_public_key(
        payload.challenge_id, payload.team_id, payload.flag_name, payload.public_key
    )
    return {"status": "ok"}


@router.post("/get-encrypted-flag")
async def get_encrypted_flag(payload: EncryptedFlagRequest):
    """Return RSA-OAEP encrypted flag for the given challenge/team/flag name."""
    if settings.FLAG_SERVER_TOKEN and payload.server_token != settings.FLAG_SERVER_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid server token")
    try:
        encrypted = await flag_server_service.get_encrypted_flag(
            payload.challenge_id, payload.team_id, payload.flag_name or "default"
        )
        return {"ciphertext": encrypted, "algorithm": "RSA-OAEP-SHA256"}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/health")
async def health():
    return {"status": "ok"}
