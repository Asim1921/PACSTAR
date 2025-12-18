from fastapi import APIRouter, Depends, Request, status, HTTPException

from app.services.role_service import RoleService
from app.db.models.user import UserInDB
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse, RoleListResponse

router = APIRouter(prefix="/roles", tags=["roles"])

# Create role service instance lazily to avoid initialization issues
def get_role_service():
    return RoleService()


# Import get_current_user from user module
from app.api.v1.endpoints.user import get_current_user


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(request: RoleCreate, current_user: UserInDB = Depends(get_current_user)):
    """
    Create a new role (Master only).
    """
    role_service = get_role_service()
    return await role_service.create_role(current_user, request)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    request: RoleUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Update role details (Master only).
    """
    role_service = get_role_service()
    return await role_service.update_role(current_user, role_id, request)


@router.get("/", response_model=RoleListResponse)
async def list_roles(current_user: UserInDB = Depends(get_current_user)):
    """
    List all roles (Master/Admin only).
    """
    role_service = get_role_service()
    roles = await role_service.list_roles(current_user)
    return {"roles": [RoleResponse(**r.dict(by_alias=True)) for r in roles]}
