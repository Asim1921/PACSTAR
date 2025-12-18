from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    zone: Optional[str] = Field(None, min_length=2, max_length=50, description="Zone for individual registration or when creating new team")
    team_code: Optional[str] = Field(None, min_length=3, max_length=20, description="Team code to join (alternative to zone)")
    create_team: Optional[bool] = Field(default=False, description="Create a new team instead of joining")
    team_name: Optional[str] = Field(None, min_length=3, max_length=50, description="Team name (if creating new team)")


class RegisterResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str = "User"
    is_active: bool = True
    zone: str
    team_code: Optional[str] = None
    team_id: Optional[str] = None
    team_created: Optional[bool] = None
    team_name: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
