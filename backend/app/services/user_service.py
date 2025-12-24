from fastapi import HTTPException, status
from bson import ObjectId
import motor.motor_asyncio

from app.core.config import settings
from app.core.security import hash_password
from app.utils.password_validator import validate_password
from app.services.team_service import team_service
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
        teams = self.db["teams"]
        async for doc in cursor:
            # Enrich with team name if possible (helps admin UI)
            try:
                team_id = doc.get("team_id")
                team_oid: ObjectId | None = None
                if isinstance(team_id, ObjectId):
                    team_oid = team_id
                    doc["team_id"] = str(team_id)
                elif isinstance(team_id, str) and ObjectId.is_valid(team_id):
                    team_oid = ObjectId(team_id)

                if team_oid and not doc.get("team_name"):
                    team_doc = await teams.find_one({"_id": team_oid})
                    if team_doc:
                        doc["team_name"] = team_doc.get("name")
                        if not doc.get("team_code"):
                            doc["team_code"] = team_doc.get("team_code")
            except Exception:
                pass
            doc["_id"] = str(doc["_id"])   # ✅ normalize each user
            users.append(UserInDB.model_validate(doc))
        return users

    async def set_user_verification(
        self,
        current_user: UserInDB,
        target_user_id: str,
        is_verified: bool,
    ) -> UserInDB:
        """Set user verification status (Master/Admin only; zone-restricted for Admin)."""
        if current_user.role not in ["Master", "Admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

        if not ObjectId.is_valid(target_user_id):
            raise HTTPException(status_code=400, detail="Invalid target user ID")

        target_user = await self.users.find_one({"_id": ObjectId(target_user_id)})
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")

        # Zone admin restrictions
        if current_user.role == "Admin":
            if target_user.get("zone") != current_user.zone:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins can only manage users in their own zone",
                )
            if target_user.get("role") in ["Admin", "Master"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admins cannot modify Admin or Master accounts",
                )

        # Only allow verifying regular users
        if target_user.get("role") != "User":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only User accounts have verification status",
            )

        await self.users.update_one(
            {"_id": ObjectId(target_user_id)},
            {"$set": {"is_verified": bool(is_verified)}},
        )

        updated = await self.users.find_one({"_id": ObjectId(target_user_id)})
        if not updated:
            raise HTTPException(status_code=404, detail="Updated user not found")
        updated["_id"] = str(updated["_id"])
        return UserInDB.model_validate(updated)

    async def delete_user(self, current_user: UserInDB, target_user_id: str) -> dict:
        """Delete a user (Master only). Cleans up refresh tokens and team membership links."""
        if current_user.role not in ["Master", "Admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master/Admin can delete users")

        if not ObjectId.is_valid(target_user_id):
            raise HTTPException(status_code=400, detail="Invalid target user ID")

        user_doc = await self.users.find_one({"_id": ObjectId(target_user_id)})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        # Zone Admin restrictions
        if current_user.role == "Admin":
            if user_doc.get("zone") != current_user.zone:
                raise HTTPException(status_code=403, detail="Admins can only delete users in their own zone")
            if user_doc.get("role") in ["Admin", "Master"]:
                raise HTTPException(status_code=400, detail="Admins cannot delete Admin/Master accounts")

        if user_doc.get("role") == "Master":
            raise HTTPException(status_code=400, detail="Cannot delete Master account")

        # Prevent deleting a team leader without deleting their team first
        teams = self.db["teams"]
        leader_team = await teams.find_one({"leader_id": target_user_id})
        if leader_team:
            raise HTTPException(
                status_code=400,
                detail="User is a team leader. Delete the team first (or change leader) before deleting this user.",
            )

        # Remove user from any team membership array (defensive)
        await teams.update_many(
            {"members.user_id": target_user_id},
            {
                "$pull": {"members": {"user_id": target_user_id}},
                "$inc": {"member_count": -1},
                "$set": {"updated_at": __import__("datetime").datetime.utcnow()},
            },
        )

        # Revoke/delete refresh tokens for this user
        await self.db["refresh_tokens"].delete_many({"user": target_user_id})

        # Finally delete the user
        res = await self.users.delete_one({"_id": ObjectId(target_user_id)})
        if res.deleted_count != 1:
            raise HTTPException(status_code=500, detail="Failed to delete user")

        return {"success": True, "user_id": target_user_id}

    async def purge_users_and_teams(self, current_user: UserInDB, confirm_phrase: str) -> dict:
        """
        DANGEROUS: Purge all non-Master users and ALL teams.
        Also cleans related collections so the DB is consistent.
        """
        if current_user.role != "Master":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can purge users/teams")

        expected = "DELETE_ALL_NON_MASTER_USERS_AND_TEAMS"
        if (confirm_phrase or "").strip() != expected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Invalid confirm_phrase. To proceed, set confirm_phrase to "{expected}".',
            )

        # Keep all Master accounts (not just the current one)
        master_docs = await self.users.find({"role": "Master"}, {"_id": 1}).to_list(length=100)
        master_ids = [str(d["_id"]) for d in master_docs if d.get("_id")]

        # Safety net: never allow purging if it would remove all users
        if not master_ids:
            raise HTTPException(status_code=500, detail="No Master users found; refusing to purge")

        teams = self.db["teams"]

        # Delete ALL teams
        teams_res = await teams.delete_many({})

        # Ensure masters do not retain stale team fields (defensive)
        await self.users.update_many(
            {"role": "Master"},
            {"$unset": {"team_id": "", "team_code": "", "team_name": ""}},
        )

        # Delete all non-master users
        users_res = await self.users.delete_many({"role": {"$ne": "Master"}})

        # Cleanup refresh tokens (keep only master tokens)
        refresh_tokens = self.db["refresh_tokens"]
        refresh_res = await refresh_tokens.delete_many({"user": {"$nin": master_ids}})

        # Cleanup event-related collections (team ids are now invalid)
        event_participants = self.db["event_participants"]
        event_submissions = self.db["event_submissions"]
        event_scores = self.db.get_collection("event_scores")

        participants_res = await event_participants.delete_many({"$or": [{"team_id": {"$ne": None}}, {"user_id": {"$nin": master_ids}}]})
        event_subs_res = await event_submissions.delete_many({"$or": [{"team_id": {"$ne": None}}, {"user_id": {"$nin": master_ids}}]})
        scores_res = await event_scores.delete_many({}) if event_scores is not None else None

        # Cleanup challenge instances (these are per-team)
        challenge_instances = self.db.get_collection("challenge_instances")
        challenge_instances_res = await challenge_instances.delete_many({}) if challenge_instances is not None else None

        # Cleanup global submissions (these are team/user specific)
        submissions = self.db.get_collection("submissions")
        submissions_res = await submissions.delete_many({}) if submissions is not None else None

        # Cleanup per-user notifications
        notifications = self.db.get_collection("notifications")
        notifications_res = await notifications.delete_many({"user_id": {"$nin": master_ids}}) if notifications is not None else None

        return {
            "success": True,
            "kept_master_user_ids": master_ids,
            "deleted_teams": int(getattr(teams_res, "deleted_count", 0) or 0),
            "deleted_users": int(getattr(users_res, "deleted_count", 0) or 0),
            "deleted_refresh_tokens": int(getattr(refresh_res, "deleted_count", 0) or 0),
            "deleted_event_participants": int(getattr(participants_res, "deleted_count", 0) or 0),
            "deleted_event_submissions": int(getattr(event_subs_res, "deleted_count", 0) or 0),
            "deleted_event_scores": int(getattr(scores_res, "deleted_count", 0) or 0) if scores_res is not None else 0,
            "deleted_challenge_instances": int(getattr(challenge_instances_res, "deleted_count", 0) or 0) if challenge_instances_res is not None else 0,
            "deleted_submissions": int(getattr(submissions_res, "deleted_count", 0) or 0) if submissions_res is not None else 0,
            "deleted_notifications": int(getattr(notifications_res, "deleted_count", 0) or 0) if notifications_res is not None else 0,
        }

    async def create_admin_user(self, current_user: UserInDB, body) -> UserInDB:
        """Master-only: create an Admin user in a specific zone."""
        if current_user.role != "Master":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can create Admin users")

        # Validate password strength
        validate_password(body.password)

        # Prevent duplicates (username/email)
        existing = await self.users.find_one({"$or": [{"username": body.username}, {"email": body.email}]})
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already exists")

        user_doc = {
            "username": body.username,
            "email": str(body.email),
            "hashed_password": hash_password(body.password),
            "role": "Admin",
            "is_active": True,  # Admins are always active by default
            "is_verified": True,  # Admins are verified by default
            "zone": body.zone,
            "created_at": __import__("datetime").datetime.utcnow(),
            "updated_at": __import__("datetime").datetime.utcnow(),
        }

        res = await self.users.insert_one(user_doc)
        user_id = str(res.inserted_id)

        # Optional: create a team for this Admin so other participants can join by team_code
        team_name = getattr(body, "team_name", None)
        if team_name and str(team_name).strip():
            team_doc = await team_service.create_team(
                team_data={
                    "name": str(team_name).strip(),
                    "description": f"Team for zone admin {body.username}",
                    "max_members": 10,
                    "is_active": True,
                    "zone": body.zone,
                },
                leader_id=user_id,
                leader_username=body.username,
                leader_email=str(body.email),
            )
            await self.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "team_id": str(team_doc.get("id") or team_doc.get("_id")),
                        "team_code": team_doc.get("team_code"),
                        "team_name": team_doc.get("name"),
                        "zone": body.zone,
                        "updated_at": __import__("datetime").datetime.utcnow(),
                    }
                },
            )

        created = await self.users.find_one({"_id": ObjectId(user_id)})
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create Admin user")
        created["_id"] = str(created["_id"])
        return UserInDB.model_validate(created)
