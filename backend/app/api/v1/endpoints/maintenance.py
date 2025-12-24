from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.db.models.user import UserInDB
from app.services.user_service import UserService


router = APIRouter(prefix="/admin", tags=["admin"])
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


class PurgeUsersTeamsRequest(BaseModel):
    confirm_phrase: str = Field(
        ...,
        description='Safety confirmation. Must equal "DELETE_ALL_NON_MASTER_USERS_AND_TEAMS".',
        min_length=8,
        max_length=128,
    )


@router.post("/purge/users-teams", response_model=dict)
async def purge_users_and_teams(
    body: PurgeUsersTeamsRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    DANGEROUS: Purge all non-Master users and ALL teams from the database (Master only).
    Also cleans up related collections so the DB is truly cleared.
    """
    return await user_service.purge_users_and_teams(current_user=current_user, confirm_phrase=body.confirm_phrase)


