from fastapi import HTTPException, status
from bson import ObjectId
import motor.motor_asyncio

from app.core.config import settings
from app.core.security import hash_password
from app.db.models.user import UserInDB
from app.schemas.user import UserUpdate


class UserService:
    def __init__(self):
        # Build TLS args if enabled
        tls_args = {}
        mongodb_tls = getattr(settings, "MONGODB_TLS", False)
        # Handle string values from environment variables
        if isinstance(mongodb_tls, str):
            mongodb_tls = mongodb_tls.lower() in ('true', '1', 'yes', 'on')
        
        if mongodb_tls:
            tls_args = {
                "tls": True,
            }
            if settings.MONGODB_CA_FILE:
                tls_args["tlsCAFile"] = settings.MONGODB_CA_FILE
            if settings.MONGODB_CLIENT_CERT_KEY:
                tls_args["tlsCertificateKeyFile"] = settings.MONGODB_CLIENT_CERT_KEY
        
        self.client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URI, **tls_args)
        self.db = self.client[settings.MONGODB_DB]
        self.users = self.db["users"]

    async def get_user(self, user_id: str) -> UserInDB:
        """Fetch a single user by ID"""
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID")

        user = await self.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user["_id"] = str(user["_id"])   # ✅ normalize
        return UserInDB.model_validate(user)

    async def update_user(
        self,
        current_user: UserInDB,
        target_user_id: str,
        update_data: UserUpdate,
    ) -> UserInDB:
        """Update user with RBAC + zone restrictions"""
        if not ObjectId.is_valid(target_user_id):
            raise HTTPException(status_code=400, detail="Invalid target user ID")

        target_user = await self.users.find_one({"_id": ObjectId(target_user_id)})
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")

        # --- RBAC & Zone rules ---
        if current_user.role == "Master":
            pass  # Master can update anyone in any zone

        elif current_user.role == "Admin":
            if target_user["zone"] != current_user.zone:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins can only manage users in their own zone",
                )
            if target_user["role"] in ["Admin", "Master"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins cannot modify Admin or Master accounts",
                )
            if update_data.role and update_data.role != "User":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins can only assign 'User' role",
                )

        elif current_user.role == "User":
            if str(current_user.id) != str(target_user_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Users can only update their own account",
                )
            if update_data.role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Users cannot change their role",
                )
            if update_data.zone and update_data.zone != current_user.zone:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Users cannot change their zone",
                )

        # --- Apply updates ---
        update_dict = update_data.dict(exclude_unset=True)
        if "password" in update_dict:
            update_dict["hashed_password"] = hash_password(update_dict.pop("password"))

        if not update_dict:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        await self.users.update_one(
            {"_id": ObjectId(target_user_id)}, {"$set": update_dict}
        )

        updated = await self.users.find_one({"_id": ObjectId(target_user_id)})
        if not updated:
            raise HTTPException(status_code=404, detail="Updated user not found")
        updated["_id"] = str(updated["_id"])   
        return UserInDB.model_validate(updated)

    async def list_users(self, current_user: UserInDB) -> list[UserInDB]:
        """List users with zone-aware RBAC"""
        if current_user.role == "Master":
            cursor = self.users.find({})
        elif current_user.role == "Admin":
            cursor = self.users.find({"zone": current_user.zone})
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to list users",
            )

        users = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])   # ✅ normalize each user
            users.append(UserInDB.model_validate(doc))
        return users
