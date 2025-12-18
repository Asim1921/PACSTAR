from fastapi import HTTPException, status
from bson import ObjectId
import motor.motor_asyncio
import os

from app.core.config import settings
from app.db.models.role import RoleInDB
from app.db.models.user import UserInDB
from app.schemas.role import RoleCreate, RoleUpdate


class RoleService:
    def __init__(self):
        # Build TLS args if enabled
        tls_args = {}
        # Force TLS to False for now to avoid certificate issues
        mongodb_tls = False
        
        if mongodb_tls:
            tls_args = {
                "tls": True,
            }
            # Only add certificate files if TLS is enabled AND files exist
            if settings.MONGODB_CA_FILE and os.path.exists(settings.MONGODB_CA_FILE):
                tls_args["tlsCAFile"] = settings.MONGODB_CA_FILE
            if settings.MONGODB_CLIENT_CERT_KEY and os.path.exists(settings.MONGODB_CLIENT_CERT_KEY):
                tls_args["tlsCertificateKeyFile"] = settings.MONGODB_CLIENT_CERT_KEY
        
        # Use clean URI without TLS parameters if TLS is disabled
        if mongodb_tls:
            mongodb_uri = settings.MONGODB_URI
        else:
            # Remove TLS parameters from URI for non-TLS connections
            mongodb_uri = settings.MONGODB_URI.split('?')[0]  # Remove query parameters
        
        self.client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_uri, **tls_args)
        self.db = self.client[settings.MONGODB_DB]
        self.roles = self.db["roles"]

    async def create_role(self, current_user: UserInDB, request: RoleCreate):
        # Only Master can create
        if current_user.role != "Master":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Master can create new roles",
            )

        # Check for existing role
        existing = await self.roles.find_one({"name": request.name})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role already exists",
            )

        role_doc = {
            "name": request.name,
            "permissions": request.permissions or [],
        }
        result = await self.roles.insert_one(role_doc)

        role_doc["_id"] = str(result.inserted_id)
        return RoleInDB.model_validate(role_doc)

    async def update_role(self, current_user: UserInDB, role_id: str, request: RoleUpdate):
        # Only Master can update
        if current_user.role != "Master":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Master can update roles",
            )

        role = await self.roles.find_one({"_id": ObjectId(role_id)})
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")

        update_dict = request.dict(exclude_unset=True)

        await self.roles.update_one({"_id": ObjectId(role_id)}, {"$set": update_dict})
        updated = await self.roles.find_one({"_id": ObjectId(role_id)})

        if not updated:
            raise HTTPException(status_code=404, detail="Role not found after update")

        updated["_id"] = str(updated["_id"])
        return RoleInDB.model_validate(updated)

    async def list_roles(self, current_user: UserInDB):
        # Only Master/Admin can list
        if current_user.role not in ["Master", "Admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to list roles",
            )

        cursor = self.roles.find({})
        roles = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            roles.append(RoleInDB.model_validate(doc))

        return roles
