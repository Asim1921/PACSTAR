from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.db.init_db import get_database

# This will be set when the database is initialized
Challenge = None
ChallengeInstance = None


async def initialize_challenge_models():
    """Initialize challenge models with the database"""
    global Challenge, ChallengeInstance
    
    db = await get_database()
    
    # Challenge collection
    Challenge = db[settings.MONGODB_DB].challenges
    
    # ChallengeInstance collection (for individual instances)
    ChallengeInstance = db[settings.MONGODB_DB].challenge_instances
    
    # Create indexes for better performance
    await Challenge.create_index("name", unique=True)
    await Challenge.create_index("created_by")
    await Challenge.create_index("status")
    await Challenge.create_index("created_at")
    
    await ChallengeInstance.create_index("challenge_id")
    await ChallengeInstance.create_index("team_id")
    await ChallengeInstance.create_index("instance_id", unique=True)
    await ChallengeInstance.create_index("public_ip", unique=True)
