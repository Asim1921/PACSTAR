from fastapi import APIRouter, Depends, Request, status, HTTPException
from bson import ObjectId

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
)
from app.schemas.user import UserResponse
from app.utils.token_utils import extract_user_id_from_request

router = APIRouter(prefix="/auth", tags=["auth"])
auth_service = AuthService()
user_service = UserService()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_user(request: RegisterRequest):
    """
    Register a new user (default role = User).
    Supports team registration via team_code or create_team option.
    """
    user = await auth_service.register_user(request)
    user_dict = {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "zone": user.zone,      
        "is_active": user.is_active,
        "is_verified": getattr(user, "is_verified", True),
    }
    # Add team info if available (check user document for team fields)
    user_doc = await auth_service.users.find_one({"_id": user.id})
    if user_doc:
        if user_doc.get("team_code"):
            user_dict["team_code"] = user_doc["team_code"]
        if user_doc.get("team_id"):
            user_dict["team_id"] = str(user_doc["team_id"])
    
    # If team was created, also return team name for display
    if request.create_team and user_doc and user_doc.get("team_code"):
        user_dict["team_created"] = True
        user_dict["team_name"] = request.team_name
    
    return user_dict


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, creds: LoginRequest):
    """
    Authenticate user and return access + refresh tokens.
    """
    return await auth_service.login_user(request, creds)


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(body: RefreshTokenRequest):
    """
    Rotate refresh token and return new access + refresh tokens.
    """
    return await auth_service.refresh_access_token(body.refresh_token)


@router.post("/logout")
async def logout(body: RefreshTokenRequest):
    """
    Revoke refresh token (logout).
    """
    return await auth_service.logout(body.refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(request: Request):
    """
    Get the profile of the currently authenticated user.
    """
    # Get user from RBAC middleware (already authenticated)
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    
    # Convert user dict and map _id to id for UserResponse schema
    user_dict = user.dict(by_alias=True) if hasattr(user, 'dict') else dict(user)
    if "_id" in user_dict:
        user_dict["id"] = str(user_dict.pop("_id"))
    
    # Get team info from database if not already in user dict
    if "team_id" not in user_dict or "team_code" not in user_dict:
        user_doc = await auth_service.users.find_one({"_id": ObjectId(user_dict["id"])})
        if user_doc:
            if user_doc.get("team_id"):
                user_dict["team_id"] = str(user_doc["team_id"])
            if user_doc.get("team_code"):
                user_dict["team_code"] = user_doc["team_code"]
            # Ensure verification status is always present (backward compatible for older docs)
            if "is_verified" not in user_dict:
                user_dict["is_verified"] = user_doc.get("is_verified", True)

    return UserResponse(**user_dict)
