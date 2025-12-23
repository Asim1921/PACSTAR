from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    role: str = Field(default="User", description="User role: Master, Admin, or User")
    is_active: bool = Field(default=True, description="Whether the account is active")
    zone: str = Field(..., min_length=2, max_length=50, description="Zone assigned to the user")  # ✅ new field


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Plain password (will be hashed)")


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    role: Optional[str] = None
    is_active: Optional[bool] = None
    zone: Optional[str] = Field(None, min_length=2, max_length=50)


class PasswordResetRequest(BaseModel):
    """Request body for admin-driven password resets."""
    new_password: str = Field(..., min_length=8, description="New plaintext password (will be hashed)")


class UserResponse(UserBase):
    id: str = Field(..., description="User ID as string")
    team_code: Optional[str] = Field(None, description="Team code if user belongs to a team")
    team_id: Optional[str] = Field(None, description="Team ID if user belongs to a team")


class UserListResponse(BaseModel):
    users: list[UserResponse]
