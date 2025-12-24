from fastapi import APIRouter, Depends, Request, HTTPException, status
from app.services.user_service import UserService
from app.db.models.user import UserInDB, UserPublic
from app.schemas.user import UserUpdate, PasswordResetRequest, UserVerificationUpdate, UserResponse
from pydantic import BaseModel, Field, EmailStr
from typing import Optional


router = APIRouter(prefix="/users", tags=["users"])
user_service = UserService()

def _to_user_response(user: UserInDB) -> UserResponse:
    """Normalize DB user model to API response with `id` string (not `_id`)."""
    data = user.dict(by_alias=True) if hasattr(user, "dict") else dict(user)
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    # Ensure team_id is string if present
    if data.get("team_id") is not None:
        data["team_id"] = str(data["team_id"])
    return UserResponse(**data)


# Dependency to get current user from RBAC middleware
async def get_current_user(request: Request) -> UserInDB:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    return user


@router.get("/", response_model=list[UserResponse])
async def list_users(current_user: UserInDB = Depends(get_current_user)):
    """
    List all users (Master/Admin only).
    Zone-restricted for Admins.
    """
    users = await user_service.list_users(current_user)
    return [_to_user_response(u) for u in users]


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserInDB = Depends(get_current_user)):
    """
    Get your own profile.
    """
    return _to_user_response(current_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: UserInDB = Depends(get_current_user)):
    """
    Get a single user profile.
    - Master can get anyone.
    - Admin can only get users in their own zone.
    - Users can only get themselves.
    """
    # Users can only view self
    if current_user.role == "User" and str(current_user.id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Users can only view their own profile",
        )

    user = await user_service.get_user(user_id)

    # Admins must respect zone boundaries
    if current_user.role == "Admin" and user.zone != current_user.zone:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins can only view users in their own zone",
        )

    return _to_user_response(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update: UserUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Update user details (role + zone restrictions applied).
    """
    updated = await user_service.update_user(current_user, user_id, update)
    return _to_user_response(updated)


@router.post("/{user_id}/reset-password", response_model=dict)
async def reset_user_password(
    user_id: str,
    body: PasswordResetRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Reset a user's password (Master/Admin only).
    - Master: can reset anyone
    - Admin: can reset users in their own zone; cannot reset Admin/Master accounts
    """
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Reuse existing RBAC logic in user_service.update_user (handles zone + role restrictions)
    update = UserUpdate(password=body.new_password)
    updated = await user_service.update_user(current_user, user_id, update)
    return {"success": True, "user_id": str(updated.id)}


@router.patch("/{user_id}/verify", response_model=UserResponse)
async def set_user_verification(
    user_id: str,
    body: UserVerificationUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Set a user's verification status (Master/Admin only).
    - Master: can verify/unverify any User in any zone
    - Admin: can verify/unverify Users in their own zone only; cannot verify Admin/Master
    """
    updated = await user_service.set_user_verification(current_user, user_id, body.is_verified)
    return _to_user_response(updated)


@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Delete a user (Master/Admin).
    - Prevents deleting Master accounts
    - Prevents deleting team leaders unless team is deleted first
    """
    return await user_service.delete_user(current_user, user_id)


class AdminCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    zone: str = Field(..., min_length=2, max_length=50)
    # If provided, create a team for this Admin so others can join via team_code.
    team_name: Optional[str] = Field(None, min_length=2, max_length=80)


@router.post("/create-admin", response_model=UserResponse)
async def create_admin_user(
    body: AdminCreateRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Create an Admin user (Master only).
    Master can create zone admins directly by providing username/email/password/zone.
    """
    created = await user_service.create_admin_user(current_user=current_user, body=body)
    return _to_user_response(created)
