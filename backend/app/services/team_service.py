"""
Team management service
"""
import motor.motor_asyncio
import random
import string
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException, status

from app.core.config import settings


class TeamService:
    def __init__(self):
        # Build TLS args if enabled
        tls_args = {}
        mongodb_tls = getattr(settings, "MONGODB_TLS", False)
        
        if mongodb_tls:
            tls_args = {"tls": True}
        
        mongodb_uri = settings.MONGODB_URI.split('?')[0] if not mongodb_tls else settings.MONGODB_URI
        
        self.client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_uri, **tls_args)
        self.db = self.client[settings.MONGODB_DB]
        self.teams = self.db["teams"]
        self.users = self.db["users"]
    
    def _generate_team_code(self, length: int = 6) -> str:
        """Generate a unique team code"""
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))
    
    async def _get_unique_team_code(self) -> str:
        """Generate a unique team code that doesn't exist"""
        max_attempts = 10
        for _ in range(max_attempts):
            code = self._generate_team_code()
            existing = await self.teams.find_one({"team_code": code})
            if not existing:
                return code
        raise RuntimeError("Failed to generate unique team code")
    
    async def create_team(self, team_data: dict, leader_id: str, leader_username: str, leader_email: str) -> dict:
        """Create a new team"""
        # Generate unique team code
        team_code = await self._get_unique_team_code()
        
        # Create team document
        team_doc = {
            "name": team_data.get("name"),
            "description": team_data.get("description"),
            "team_code": team_code,
            "leader_id": leader_id,
            "leader_username": leader_username,
            "max_members": team_data.get("max_members", 10),
            "is_active": team_data.get("is_active", True),
            "zone": team_data.get("zone"),  # Store zone if provided
            "members": [
                {
                    "user_id": leader_id,
                    "username": leader_username,
                    "email": leader_email,
                    "role": "leader",
                    "joined_at": datetime.utcnow()
                }
            ],
            "member_count": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await self.teams.insert_one(team_doc)
        team_doc["_id"] = str(result.inserted_id)
        team_doc["id"] = team_doc["_id"]
        
        return team_doc
    
    async def get_team_by_code(self, team_code: str) -> dict:
        """Get team by team code"""
        team = await self.teams.find_one({"team_code": team_code.upper()})
        if team:
            team["_id"] = str(team["_id"])
            team["id"] = team["_id"]
            # Ensure member_count is accurate (calculate from members array)
            members = team.get("members", [])
            team["member_count"] = len(members)
            # Ensure members array is properly formatted for Pydantic
            formatted_members = []
            for member in members:
                formatted_member = {
                    "user_id": str(member.get("user_id", "")),
                    "username": str(member.get("username", "")),
                    "email": str(member.get("email", "")),
                    "role": str(member.get("role", "member")),
                    "joined_at": member.get("joined_at")  # Should already be datetime
                }
                formatted_members.append(formatted_member)
            team["members"] = formatted_members
        return team
    
    async def get_team_by_id(self, team_id: str) -> dict:
        """Get team by ID"""
        team = await self.teams.find_one({"_id": ObjectId(team_id)})
        if team:
            team["_id"] = str(team["_id"])
            team["id"] = team["_id"]
            # Ensure member_count is accurate (calculate from members array)
            members = team.get("members", [])
            team["member_count"] = len(members)
            # Ensure members array is properly formatted for Pydantic
            formatted_members = []
            for member in members:
                formatted_member = {
                    "user_id": str(member.get("user_id", "")),
                    "username": str(member.get("username", "")),
                    "email": str(member.get("email", "")),
                    "role": str(member.get("role", "member")),
                    "joined_at": member.get("joined_at")  # Should already be datetime
                }
                formatted_members.append(formatted_member)
            team["members"] = formatted_members
        return team
    
    async def get_user_team(self, user_id: str) -> dict:
        """Get team that user belongs to"""
        team = await self.teams.find_one({
            "members.user_id": user_id,
            "is_active": True
        })
        if team:
            team["_id"] = str(team["_id"])
            team["id"] = team["_id"]
            # Ensure member_count is accurate (calculate from members array)
            members = team.get("members", [])
            team["member_count"] = len(members)
            # Ensure members array is properly formatted for Pydantic
            # Convert any ObjectId fields to strings and ensure datetime is proper
            formatted_members = []
            for member in members:
                formatted_member = {
                    "user_id": str(member.get("user_id", "")),
                    "username": str(member.get("username", "")),
                    "email": str(member.get("email", "")),
                    "role": str(member.get("role", "member")),
                    "joined_at": member.get("joined_at")  # Should already be datetime
                }
                formatted_members.append(formatted_member)
            team["members"] = formatted_members
        return team
    
    async def join_team(self, team_code: str, user_id: str, username: str, email: str) -> dict:
        """Join a team using team code"""
        team = await self.get_team_by_code(team_code.upper())
        
        if not team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found. Please check the team code."
            )
        
        if not team.get("is_active", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team is not active"
            )
        
        # Check if user is already a member
        existing_member = next(
            (m for m in team.get("members", []) if m["user_id"] == user_id),
            None
        )
        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this team"
            )
        
        # Check if team is full
        current_count = team.get("member_count", 0)
        max_members = team.get("max_members", 10)
        if current_count >= max_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Team is full (max {max_members} members)"
            )
        
        # Add user to team
        new_member = {
            "user_id": user_id,
            "username": username,
            "email": email,
            "role": "member",
            "joined_at": datetime.utcnow()
        }
        
        await self.teams.update_one(
            {"_id": ObjectId(team["id"])},
            {
                "$push": {"members": new_member},
                "$inc": {"member_count": 1},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Get updated team
        updated_team = await self.get_team_by_id(team["id"])
        return updated_team
    
    async def list_teams(self, skip: int = 0, limit: int = 100, include_inactive: bool = False, zone: str | None = None) -> list:
        """List teams (optionally include inactive; optionally filter by zone)."""
        query: dict = {}
        if not include_inactive:
            query["is_active"] = True
        if zone:
            query["zone"] = zone

        cursor = self.teams.find(query).skip(skip).limit(limit)
        teams = []
        async for team in cursor:
            team["_id"] = str(team["_id"])
            team["id"] = team["_id"]
            # Ensure member_count is accurate (calculate from members array)
            members = team.get("members", [])
            team["member_count"] = len(members)
            # Ensure members array is properly formatted for Pydantic
            formatted_members = []
            for member in members:
                formatted_member = {
                    "user_id": str(member.get("user_id", "")),
                    "username": str(member.get("username", "")),
                    "email": str(member.get("email", "")),
                    "role": str(member.get("role", "member")),
                    "joined_at": member.get("joined_at")  # Should already be datetime
                }
                formatted_members.append(formatted_member)
            team["members"] = formatted_members
            teams.append(team)
        return teams
    
    async def get_team_members(self, team_id: str) -> list:
        """Get all members of a team"""
        team = await self.get_team_by_id(team_id)
        if not team:
            return []
        return team.get("members", [])

    async def set_team_active(self, team_id: str, is_active: bool) -> dict:
        """Enable/disable (ban/unban) a team by ID."""
        if not ObjectId.is_valid(team_id):
            raise HTTPException(status_code=400, detail="Invalid team ID")

        await self.teams.update_one(
            {"_id": ObjectId(team_id)},
            {"$set": {"is_active": bool(is_active), "updated_at": datetime.utcnow()}},
        )
        updated = await self.get_team_by_id(team_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Team not found")
        return updated

    async def delete_team(self, team_id: str) -> dict:
        """Delete a team and unset team fields for all users in that team."""
        if not ObjectId.is_valid(team_id):
            raise HTTPException(status_code=400, detail="Invalid team ID")

        team = await self.teams.find_one({"_id": ObjectId(team_id)})
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")

        # Unset team fields for users that reference this team (support string or ObjectId storage)
        team_oid = ObjectId(team_id)
        await self.users.update_many(
            {"$or": [{"team_id": team_id}, {"team_id": team_oid}]},
            {"$unset": {"team_id": "", "team_code": "", "team_name": ""}},
        )

        # Delete the team
        res = await self.teams.delete_one({"_id": ObjectId(team_id)})
        if res.deleted_count != 1:
            raise HTTPException(status_code=500, detail="Failed to delete team")

        return {"success": True, "team_id": team_id}

    async def move_user_to_team_by_code(
        self,
        user_id: str,
        team_code: str,
    ) -> dict:
        """
        Move a user into a team (Master-only endpoint will call this).
        - Removes user from their current team membership (if any)
        - Adds user to destination team (checks max_members + active)
        - Updates user.team_id/team_code/team_name and zone to team's zone if present
        - BLOCK: cannot move team leaders (leader_id of any team)
        """
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

        # Destination team
        dest = await self.get_team_by_code(team_code.upper())
        if not dest:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        if not dest.get("is_active", False):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Team is not active")

        dest_id = dest.get("id")
        if not dest_id or not ObjectId.is_valid(dest_id):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Team ID invalid")

        # Load user
        user_doc = await self.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user_doc.get("role") in ["Master", "Admin"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot move Admin/Master accounts")

        # Block moving team leaders
        leader_team = await self.teams.find_one({"leader_id": user_id})
        if leader_team:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move a team leader to another team. Change team leader or delete the team first.",
            )

        # Remove user from any existing team membership (and fix member_count)
        current_team = await self.teams.find_one({"members.user_id": user_id})
        if current_team and str(current_team.get("_id")) != dest_id:
            await self.teams.update_one(
                {"_id": current_team["_id"]},
                {
                    "$pull": {"members": {"user_id": user_id}},
                    "$inc": {"member_count": -1},
                    "$set": {"updated_at": datetime.utcnow()},
                },
            )

        # Prevent duplicates in destination
        dest_team_doc = await self.teams.find_one({"_id": ObjectId(dest_id)})
        if not dest_team_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        members = dest_team_doc.get("members", []) or []
        if any(str(m.get("user_id")) == user_id for m in members):
            # Already in team; ensure user fields updated anyway
            pass
        else:
            max_members = int(dest_team_doc.get("max_members", 10))
            if len(members) >= max_members:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Team is full")

            new_member = {
                "user_id": user_id,
                "username": user_doc.get("username", ""),
                "email": user_doc.get("email", ""),
                "role": "member",
                "joined_at": datetime.utcnow(),
            }
            await self.teams.update_one(
                {"_id": ObjectId(dest_id)},
                {
                    "$push": {"members": new_member},
                    "$inc": {"member_count": 1},
                    "$set": {"updated_at": datetime.utcnow()},
                },
            )

        # Update user doc to reference destination team
        team_zone = dest_team_doc.get("zone") or dest.get("zone")  # prefer DB doc
        update_user = {
            "team_id": dest_id,
            "team_code": dest.get("team_code"),
            "team_name": dest_team_doc.get("name") or dest.get("name"),
        }
        if team_zone:
            update_user["zone"] = team_zone

        await self.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_user})
        return {"success": True, "user_id": user_id, "team_id": dest_id, "team_code": dest.get("team_code")}


# Global instance
team_service = TeamService()

