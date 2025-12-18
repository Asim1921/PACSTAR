from fastapi import APIRouter
from app.api.v1.endpoints import auth
from app.api.v1.endpoints import user # type: ignore
from app.api.v1.endpoints import role # type: ignore

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(user.router, prefix="/users", tags=["users"])
api_router.include_router(role.router, prefix="/roles", tags=["roles"])
