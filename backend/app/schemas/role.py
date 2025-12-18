from typing import List, Optional
from pydantic import BaseModel, Field


class RoleBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=30)  # e.g., Master, Admin, User
    permissions: List[str] = []


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=30)
    permissions: Optional[List[str]] = None


class RoleResponse(RoleBase):
    id: str

    class Config:
        from_attributes = True  # ✅ Pydantic v2 replacement for orm_mode


class RoleListResponse(BaseModel):
    roles: List[RoleResponse]
