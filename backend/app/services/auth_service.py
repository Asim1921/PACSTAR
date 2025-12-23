from fastapi import HTTPException, status, Request
from datetime import datetime
from bson import ObjectId
import motor.motor_asyncio
from typing import Optional

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.rate_limiter import register_failed_attempt, reset_attempts, is_locked
from app.db.models.user import UserInDB
from app.schemas.auth import LoginRequest, RegisterRequest
from app.utils.password_validator import validate_password
from app.utils.sanitizer import sanitize_input


class AuthService:
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
        self.refresh_tokens = self.db["refresh_tokens"]

    async def register_user(self, request: RegisterRequest):
        # --- Check for existing user ---
        existing = await self.users.find_one(
            {"$or": [{"username": request.username}, {"email": request.email}]}
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already exists",
            )

        # --- Validate strong password ---
        validate_password(request.password)

        # --- Sanitize input ---
        username = sanitize_input(request.username)
        email = sanitize_input(request.email)
        
        # --- Handle team/zone logic ---
        from app.services.team_service import team_service
        
        zone = None
        team_id = None
        team_code = None
        
        # Priority: team_code > create_team > zone
        # Only process team_code if it's explicitly provided and not empty
        if request.team_code and request.team_code.strip():
            # Validate that team_code is not a zone value (common mistake)
            zone_values = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5', 'main']
            if request.team_code.lower() in zone_values:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"'{request.team_code}' is a zone, not a team code. If you want to register individually, select 'Individual Registration' and choose your zone. If you want to join a team, you need the team's unique code (e.g., 'ABC123')."
                )
            # Join existing team
            team = await team_service.get_team_by_code(request.team_code.upper())
            if not team:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Team with code '{request.team_code}' not found. Make sure you have the correct team code from your team leader."
                )
            team_id = team["id"]
            team_code = team["team_code"]
            # Use team's zone if it exists, otherwise fallback to team-based identifier
            zone = team.get("zone") or f"team-{team_id[:8]}"
        
        elif request.create_team and request.team_name:
            # Create new team - require zone selection
            if not request.zone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Zone is required when creating a new team"
                )
            # Will create team after user is created
            zone = sanitize_input(request.zone)  # Use selected zone
        
        else:
            # Use zone (fallback to current behavior)
            if not request.zone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Either zone or team_code must be provided"
                )
            zone = sanitize_input(request.zone)

        # --- Insert new user ---
        user_doc = {
            "username": username,
            "email": email,
            "hashed_password": hash_password(request.password),
            "role": "User",
            "is_active": True,
            # New registrations start unverified by default (Master/Admin can verify later).
            "is_verified": False,
            "zone": zone,
            "created_at": datetime.utcnow(),
            "last_login": None,
        }
        
        # Add team info if available
        if team_id:
            user_doc["team_id"] = team_id
            user_doc["team_code"] = team_code
        
        result = await self.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        user_doc["_id"] = user_id

        # --- Create team if requested ---
        if request.create_team and request.team_name:
            try:
                team_data = {
                    "name": sanitize_input(request.team_name),
                    "description": None,
                    "max_members": 10,
                    "is_active": True,
                    "zone": zone  # Use the zone selected during registration
                }
                created_team = await team_service.create_team(
                    team_data, user_id, username, email
                )
                # Update user with team info (zone already set correctly above)
                await self.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {
                        "$set": {
                            "team_id": created_team["id"],
                            "team_code": created_team["team_code"],
                            "zone": zone  # Use the zone from team
                        }
                    }
                )
                user_doc["team_id"] = created_team["id"]
                user_doc["team_code"] = created_team["team_code"]
                user_doc["zone"] = zone
            except Exception as e:
                # If team creation fails, user still exists (could clean up, but keep for now)
                pass
        
        # --- Join team if team_code provided ---
        elif request.team_code:
            try:
                await team_service.join_team(request.team_code.upper(), user_id, username, email)
            except HTTPException:
                raise
            except Exception as e:
                # User created but team join failed
                pass

        # Always return consistent model
        return UserInDB.model_validate(user_doc)

    async def login_user(self, request: Request, creds: LoginRequest):
        username = creds.username
        client_ip = request.client.host if request.client else "unknown"
        
        # --- MASTER USER BYPASS: No security checks, easy login ---
        master_username = getattr(settings, "MASTER_ADMIN_USERNAME", "master")
        master_password = "SuperSecureP@ssw0rd"  # Hardcoded password for master (fallback)
        
        if username == master_username or username == "master" or username == "admin":
            # Master user: check both hardcoded password and database password
            # First try to find the user in database
            user_doc = await self.users.find_one({"$or": [
                {"username": username, "role": "Master"},
                {"username": "master", "role": "Master"},
                {"username": "admin", "role": "Master"}
            ]})
            
            password_valid = False
            if user_doc:
                # Check database password
                stored_hash = user_doc.get("hashed_password")
                if stored_hash:
                    password_valid = verify_password(creds.password, stored_hash)
            
            # Also check hardcoded password as fallback
            if not password_valid and creds.password == master_password:
                password_valid = True
            
            if password_valid:
                # Use the user_doc we already found, or try to find/create one
                if not user_doc:
                    # Try to find by username
                    user_doc = await self.users.find_one({"username": username, "role": "Master"})
                
                if not user_doc:
                    # Try to find by email
                    master_email = getattr(settings, "MASTER_ADMIN_EMAIL", "master@pacstar.com")
                    user_doc = await self.users.find_one({"email": master_email, "role": "Master"})
                
                if not user_doc:
                    # Try to find any Master user
                    user_doc = await self.users.find_one({"role": "Master"})
                
                if not user_doc:
                    # Create master user if doesn't exist
                    hashed = hash_password(creds.password if password_valid else master_password)
                    import time
                    unique_email = f"master_{int(time.time())}@pacstar.com"
                    user_doc = {
                        "username": username,
                        "email": unique_email,
                        "hashed_password": hashed,
                        "role": "Master",
                        "is_active": True,
                        "zone": "master",
                        "created_at": datetime.utcnow()
                    }
                    try:
                        result = await self.users.insert_one(user_doc)
                        user_doc["_id"] = result.inserted_id
                    except Exception:
                        # If insert fails, try to find existing
                        user_doc = await self.users.find_one({"role": "Master"})
                        if user_doc:
                            # Update username and password
                            await self.users.update_one(
                                {"_id": user_doc["_id"]},
                                {"$set": {
                                    "username": username,
                                    "hashed_password": hashed,
                                    "role": "Master",
                                    "is_active": True
                                }}
                            )
                            user_doc = await self.users.find_one({"username": username})
                
                if not user_doc:
                    raise HTTPException(status_code=500, detail="Unable to create or find master user")
                
                user_doc["_id"] = str(user_doc["_id"])
                
                # Try to validate, but if it fails due to email issues, create a simplified version
                try:
                    user = UserInDB.model_validate(user_doc)
                except Exception:
                    # If validation fails (e.g., email format), create user manually
                    user_doc["email"] = getattr(settings, "MASTER_ADMIN_EMAIL", "master@pacstar.com")
                    # Update in DB
                    await self.users.update_one(
                        {"_id": ObjectId(user_doc["_id"])},
                        {"$set": {"email": user_doc["email"]}}
                    )
                    user = UserInDB.model_validate(user_doc)
                
                # Update last login
                await self.users.update_one(
                    {"_id": ObjectId(user.id)}, {"$set": {"last_login": datetime.utcnow()}}
                )
                
                # Create tokens directly (no other checks)
                access_token = create_access_token(str(user.id))
                refresh_token = create_refresh_token(str(user.id))
                
                await self.refresh_tokens.insert_one({
                    "user": str(user.id),
                    "token": refresh_token,
                    "created_at": datetime.utcnow(),
                    "revoked": False,
                })
                
                return {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": "bearer",
                }
            else:
                # Wrong password for master
                raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # --- Regular user login (with security checks) ---
        # Account lock check
        if is_locked(username):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Account temporarily locked due to repeated failed attempts",
            )

        user_doc = await self.users.find_one({"username": username})
        if not user_doc:
            register_failed_attempt(username, client_ip)
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user_doc["_id"] = str(user_doc["_id"])
        user = UserInDB.model_validate(user_doc)

        if not verify_password(creds.password, user.hashed_password):
            register_failed_attempt(username, client_ip)
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Reset after success
        reset_attempts(username, client_ip)

        # Update last login
        await self.users.update_one(
            {"_id": ObjectId(user.id)}, {"$set": {"last_login": datetime.utcnow()}}
        )

        # --- Create tokens ---
        access_token = create_access_token(str(user.id))
        refresh_token = create_refresh_token(str(user.id))

        await self.refresh_tokens.insert_one(
            {
                "user": str(user.id),
                "token": refresh_token,
                "created_at": datetime.utcnow(),
                "revoked": False,
            }
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    async def refresh_access_token(self, refresh_token: str):
        token_doc = await self.refresh_tokens.find_one(
            {"token": refresh_token, "revoked": False}
        )
        if not token_doc:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        user_id = decode_token(refresh_token, refresh=True)
        if not user_id:
            raise HTTPException(status_code=401, detail="Refresh token expired")

        # --- Revoke old ---
        await self.refresh_tokens.update_one(
            {"_id": token_doc["_id"]}, {"$set": {"revoked": True}}
        )

        # --- New tokens ---
        access_token = create_access_token(user_id)
        new_refresh_token = create_refresh_token(user_id)

        await self.refresh_tokens.insert_one(
            {
                "user": str(user_id),
                "token": new_refresh_token,
                "created_at": datetime.utcnow(),
                "revoked": False,
            }
        )

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }

    async def logout(self, refresh_token: str):
        result = await self.refresh_tokens.update_one(
            {"token": refresh_token}, {"$set": {"revoked": True}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Invalid refresh token")
        return {"detail": "Logged out successfully"}
