from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


# ✅ Updated PyObjectId for Pydantic v2
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


class RefreshTokenBase(BaseModel):
    user_id: PyObjectId = Field(..., alias="user")
    token: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    revoked: bool = False


class RefreshTokenInDB(RefreshTokenBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        populate_by_name = True  # ✅ replaces allow_population_by_field_name
        json_encoders = {ObjectId: str}
        arbitrary_types_allowed = True
        from_attributes = True  # ✅ replaces orm_mode


class RefreshTokenPublic(BaseModel):
    token: str
    created_at: datetime
    revoked: bool
