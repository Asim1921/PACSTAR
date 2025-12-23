from fastapi import APIRouter, Depends, Request, HTTPException, status
from app.services.user_service import UserService
from app.db.models.user import UserInDB, UserPublic
from app.schemas.user import UserUpdate, PasswordResetRequest


router = APIRouter(prefix="/users", tags=["users"])
user_service = UserService()


# Dependency to get current user from RBAC middleware
async def get_current_user(request: Request) -> UserInDB:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    return user


@router.get("/", response_model=list[UserPublic])
async def list_users(current_user: UserInDB = Depends(get_current_user)):
    """
    List all users (Master/Admin only).
    Zone-restricted for Admins.
    """
    users = await user_service.list_users(current_user)
    return [UserPublic.model_validate(u.dict(by_alias=True)) for u in users]


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: UserInDB = Depends(get_current_user)):
    """
    Get your own profile.
    """
    return UserPublic.model_validate(current_user.dict(by_alias=True))


@router.get("/{user_id}", response_model=UserPublic)
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

    return UserPublic.model_validate(user.dict(by_alias=True))


@router.put("/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: str,
    update: UserUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Update user details (role + zone restrictions applied).
    """
    updated = await user_service.update_user(current_user, user_id, update)
    return UserPublic.model_validate(updated.dict(by_alias=True))


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
