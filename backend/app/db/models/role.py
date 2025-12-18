from typing import List
from pydantic import BaseModel, Field
from bson import ObjectId
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


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


class RoleBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=30)  # Master, Admin, User
    permissions: List[str] = []  # Example: ["manage_users", "view_logs"]


class RoleInDB(RoleBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        populate_by_name = True  # ✅ Pydantic v2 replacement for allow_population_by_field_name
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True
        from_attributes = True  # ✅ Replacement for orm_mode


class RolePublic(RoleBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True
        from_attributes = True
