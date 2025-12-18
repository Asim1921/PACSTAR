from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


# ✅ Custom ObjectId type for Pydantic v2
class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source, _handler: GetCoreSchemaHandler):
        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.str_schema(),
        )

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)


# --- Base Schemas ---
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    role: str = Field(default="User")  # Master, Admin, User
    zone: str = Field(..., min_length=2, max_length=50)  # ✅ Zone assignment
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    hashed_password: str
    last_login: Optional[datetime] = None

    def dict(self, *args, **kwargs):
        data = super().dict(*args, **kwargs)
        if "_id" in data and isinstance(data["_id"], ObjectId):
            data["_id"] = str(data["_id"])
        return data

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        from_attributes = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None,
        }



class UserPublic(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    last_login: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        from_attributes = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None,
        }
