import motor.motor_asyncio
import os
from app.core.config import settings
from app.core.security import hash_password
import logging

logger = logging.getLogger("pacstar")

# Global database client
_db = None

async def get_database():
    """Get database client"""
    global _db
    if _db is None:
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
            # Only add certificate files if TLS is enabled AND files exist
            if settings.MONGODB_CA_FILE and os.path.exists(settings.MONGODB_CA_FILE):
                tls_args["tlsCAFile"] = settings.MONGODB_CA_FILE
            if settings.MONGODB_CLIENT_CERT_KEY and os.path.exists(settings.MONGODB_CLIENT_CERT_KEY):
                tls_args["tlsCertificateKeyFile"] = settings.MONGODB_CLIENT_CERT_KEY

        # Create secure client
        client = motor.motor_asyncio.AsyncIOMotorClient(
            settings.MONGODB_URI,
            **tls_args,
        )
        _db = client[settings.MONGODB_DB]
    return _db


async def init_db():
    """Initialize MongoDB collections, indexes, and default roles/users."""

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
        # Only add certificate files if TLS is enabled AND files exist
        if settings.MONGODB_CA_FILE and os.path.exists(settings.MONGODB_CA_FILE):
            tls_args["tlsCAFile"] = settings.MONGODB_CA_FILE
        if settings.MONGODB_CLIENT_CERT_KEY and os.path.exists(settings.MONGODB_CLIENT_CERT_KEY):
            tls_args["tlsCertificateKeyFile"] = settings.MONGODB_CLIENT_CERT_KEY

    # Create secure client
    client = motor.motor_asyncio.AsyncIOMotorClient(
        settings.MONGODB_URI,
        **tls_args,
    )
    db = client[settings.MONGODB_DB]

    # --- Users Collection ---
    users = db["users"]
    await users.create_index("username", unique=True)
    await users.create_index("email", unique=True)

    # --- Tokens Collection ---
    tokens = db["refresh_tokens"]
    await tokens.create_index("token", unique=True)
    await tokens.create_index("user_id")

    # --- Audit Logs Collection ---
    audit_logs = db[settings.AUDIT_LOG_COLLECTION]
    await audit_logs.create_index("timestamp")
    await audit_logs.create_index("action")
    
    # --- Challenges Collection ---
    challenges = db["challenges"]
    await challenges.create_index("name", unique=True)
    await challenges.create_index("created_by")
    await challenges.create_index("status")
    await challenges.create_index("created_at")
    
    # --- Challenge Instances Collection ---
    challenge_instances = db["challenge_instances"]
    await challenge_instances.create_index("challenge_id")
    await challenge_instances.create_index("team_id")
    await challenge_instances.create_index("instance_id", unique=True)
    
    # --- Teams Collection ---
    teams = db["teams"]
    await teams.create_index("team_code", unique=True)
    await teams.create_index("leader_id")
    await teams.create_index("name")
    await teams.create_index("is_active")
    await challenge_instances.create_index("public_ip", unique=True)
    
    # --- Events Collection ---
    events = db["events"]
    await events.create_index("name")
    await events.create_index("zone")
    await events.create_index("status")
    await events.create_index("event_type")
    await events.create_index("created_by")
    await events.create_index("start_time")
    await events.create_index("end_time")
    await events.create_index("created_at")
    await events.create_index([("zone", 1), ("status", 1)])  # Compound index for zone-based queries
    
    # --- Event Submissions Collection ---
    event_submissions = db["event_submissions"]
    await event_submissions.create_index("event_id")
    await event_submissions.create_index("challenge_id")
    await event_submissions.create_index("user_id")
    await event_submissions.create_index("team_id")
    await event_submissions.create_index("is_correct")
    await event_submissions.create_index("submitted_at")
    await event_submissions.create_index("ip_address")
    await event_submissions.create_index([("event_id", 1), ("user_id", 1)])  # Compound index
    await event_submissions.create_index([("event_id", 1), ("team_id", 1)])  # Compound index
    await event_submissions.create_index([("event_id", 1), ("challenge_id", 1), ("is_correct", 1)])  # For solve queries
    
    # --- Event Participants Collection ---
    event_participants = db["event_participants"]
    await event_participants.create_index("event_id")
    await event_participants.create_index("user_id")
    await event_participants.create_index("team_id")
    await event_participants.create_index("zone")
    await event_participants.create_index("total_points")
    await event_participants.create_index([("event_id", 1), ("user_id", 1)], unique=True)  # Unique registration
    await event_participants.create_index([("event_id", 1), ("total_points", -1)])  # For scoreboard
    
    # --- Event Scores Collection (for historical/aggregated scores) ---
    event_scores = db["event_scores"]
    await event_scores.create_index("event_id")
    await event_scores.create_index("participant_id")
    await event_scores.create_index("timestamp")

    # --- Roles Collection ---
    roles = db["roles"]
    existing_roles = await roles.count_documents({})
    if existing_roles == 0:
        default_roles = [
            {"name": "Master", "permissions": ["*"]},
            {"name": "Admin", "permissions": ["manage_users", "view_logs"]},
            {"name": "User", "permissions": ["basic_access"]},
        ]
        await roles.insert_many(default_roles)
        logger.info("Default roles created.")

    # --- Default Master Admin User ---
    master_user = await users.find_one({"username": settings.MASTER_ADMIN_USERNAME})
    if not master_user:
        hashed_pw = hash_password(settings.MASTER_ADMIN_PASSWORD)
        await users.insert_one(
            {
                "username": settings.MASTER_ADMIN_USERNAME,
                "email": settings.MASTER_ADMIN_EMAIL,
                "hashed_password": hashed_pw,
                "role": "Master",
                "is_active": True,
            }
        )
        logger.info(
            f"Default Master user created: {settings.MASTER_ADMIN_USERNAME} "
            f"(email: {settings.MASTER_ADMIN_EMAIL})"
        )

    logger.info("Database initialization complete.")
    return db
