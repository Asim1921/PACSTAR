import logging
from typing import Dict, List, Optional
from datetime import datetime
from bson import ObjectId

from app.schemas.challenge import (
    ChallengeCreate, ChallengeUpdate, ChallengeResponse, 
    ChallengeStatus, ChallengeInstance as ChallengeInstanceSchema
)
from app.services.kubernetes_service_mock import kubernetes_service

logger = logging.getLogger(__name__)


class ChallengeService:
    """Service for managing challenges and their Kubernetes deployments"""
    
    def __init__(self):
        self.k8s_service = kubernetes_service
        self._db = None
    
    async def _get_db(self):
        """Get database connection"""
        if self._db is None:
            from app.db.init_db import get_database
            self._db = await get_database()
        return self._db
    
    async def create_challenge(self, challenge_data: ChallengeCreate, created_by: str) -> ChallengeResponse:
        """Create a new challenge"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            # Create challenge document
            challenge_doc = {
                "name": challenge_data.name,
                "description": challenge_data.description,
                "config": challenge_data.config.dict(),
                "total_teams": challenge_data.total_teams,
                "is_active": challenge_data.is_active,
                "status": ChallengeStatus.PENDING,
                "instances": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": created_by
            }
            
            # Insert into database
            result = await challenges.insert_one(challenge_doc)
            challenge_id = str(result.inserted_id)
            
            logger.info(f"Created challenge {challenge_data.name} with ID {challenge_id}")
            
            return ChallengeResponse(
                id=challenge_id,
                **challenge_data.dict(),
                status=ChallengeStatus.PENDING,
                instances=[],
                created_at=challenge_doc["created_at"],
                updated_at=challenge_doc["updated_at"],
                created_by=created_by
            )
            
        except Exception as e:
            logger.error(f"Failed to create challenge: {e}")
            raise RuntimeError(f"Failed to create challenge: {e}")
    
    async def deploy_challenge(self, challenge_id: str, force_redeploy: bool = False) -> ChallengeResponse:
        """Deploy a challenge to Kubernetes"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            # Get challenge from database
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                raise ValueError(f"Challenge {challenge_id} not found")
            
            # Check if already deployed
            if challenge["status"] == ChallengeStatus.RUNNING and not force_redeploy:
                raise ValueError("Challenge is already running. Use force_redeploy=True to redeploy.")
            
            # Create namespace
            namespace = await self.k8s_service.create_challenge_namespace(challenge["name"])
            
            # Update status to deploying
            await challenges.update_one(
                {"_id": ObjectId(challenge_id)},
                {
                    "$set": {
                        "status": ChallengeStatus.DEPLOYING,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            instances = []
            
            # Deploy instances for each team
            for team_num in range(1, challenge["total_teams"] + 1):
                team_id = f"team-{team_num:03d}"
                
                try:
                    # Deploy instance
                    instance_data = await self.k8s_service.deploy_challenge_instance(
                        challenge["name"],
                        team_id,
                        challenge["config"],
                        namespace
                    )
                    
                    # Create instance document
                    instance_doc = {
                        "team_id": team_id,
                        "instance_id": instance_data["instance_id"],
                        "public_ip": instance_data["public_ip"],
                        "internal_ip": instance_data["internal_ip"],
                        "status": ChallengeStatus.RUNNING,
                        "created_at": datetime.utcnow(),
                        "pod_name": instance_data["pod_name"],
                        "service_name": instance_data["service_name"],
                        "namespace": namespace
                    }
                    
                    instances.append(instance_doc)
                    
                    logger.info(f"Deployed instance for team {team_id} with IP {instance_data['public_ip']}")
                    
                except Exception as e:
                    logger.error(f"Failed to deploy instance for team {team_id}: {e}")
                    # Continue with other teams even if one fails
                    continue
            
            # Update challenge with instances
            await challenges.update_one(
                {"_id": ObjectId(challenge_id)},
                {
                    "$set": {
                        "instances": instances,
                        "status": ChallengeStatus.RUNNING if instances else ChallengeStatus.FAILED,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Get updated challenge
            updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            
            return self._challenge_to_response(updated_challenge)
            
        except Exception as e:
            logger.error(f"Failed to deploy challenge {challenge_id}: {e}")
            # Update status to failed
            db = await self._get_db()
            challenges = db["challenges"]
            await challenges.update_one(
                {"_id": ObjectId(challenge_id)},
                {
                    "$set": {
                        "status": ChallengeStatus.FAILED,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            raise RuntimeError(f"Failed to deploy challenge: {e}")
    
    async def stop_challenge(self, challenge_id: str, remove_instances: bool = False) -> ChallengeResponse:
        """Stop a challenge and optionally remove all instances"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            # Get challenge from database
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                raise ValueError(f"Challenge {challenge_id} not found")
            
            # Stop all instances
            for instance in challenge.get("instances", []):
                try:
                    await self.k8s_service.stop_challenge_instance(
                        instance["namespace"],
                        instance["pod_name"],
                        instance["service_name"],
                        instance["team_id"]
                    )
                    logger.info(f"Stopped instance for team {instance['team_id']}")
                except Exception as e:
                    logger.error(f"Failed to stop instance for team {instance['team_id']}: {e}")
            
            # Update challenge status
            update_data = {
                "status": ChallengeStatus.STOPPED,
                "updated_at": datetime.utcnow()
            }
            
            if remove_instances:
                update_data["instances"] = []
                # Clean up namespace
                try:
                    await self.k8s_service.cleanup_challenge_namespace(instance["namespace"])
                except Exception as e:
                    logger.error(f"Failed to cleanup namespace: {e}")
            
            await challenges.update_one(
                {"_id": ObjectId(challenge_id)},
                {"$set": update_data}
            )
            
            # Get updated challenge
            updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            
            return self._challenge_to_response(updated_challenge)
            
        except Exception as e:
            logger.error(f"Failed to stop challenge {challenge_id}: {e}")
            raise RuntimeError(f"Failed to stop challenge: {e}")
    
    async def get_challenge(self, challenge_id: str) -> Optional[ChallengeResponse]:
        """Get a challenge by ID"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                return None
            
            return self._challenge_to_response(challenge)
            
        except Exception as e:
            logger.error(f"Failed to get challenge {challenge_id}: {e}")
            raise RuntimeError(f"Failed to get challenge: {e}")
    
    async def list_challenges(self, skip: int = 0, limit: int = 100) -> List[ChallengeResponse]:
        """List all challenges"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            challenge_docs = await challenges.find().skip(skip).limit(limit).to_list(length=limit)
            
            return [self._challenge_to_response(challenge) for challenge in challenge_docs]
            
        except Exception as e:
            logger.error(f"Failed to list challenges: {e}")
            raise RuntimeError(f"Failed to list challenges: {e}")
    
    async def update_challenge(self, challenge_id: str, update_data: ChallengeUpdate) -> ChallengeResponse:
        """Update a challenge"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            # Build update document
            update_doc = {"updated_at": datetime.utcnow()}
            
            if update_data.description is not None:
                update_doc["description"] = update_data.description
            if update_data.total_teams is not None:
                update_doc["total_teams"] = update_data.total_teams
            if update_data.is_active is not None:
                update_doc["is_active"] = update_data.is_active
            if update_data.config is not None:
                update_doc["config"] = update_data.config.dict()
            
            # Update in database
            result = await challenges.update_one(
                {"_id": ObjectId(challenge_id)},
                {"$set": update_doc}
            )
            
            if result.matched_count == 0:
                raise ValueError(f"Challenge {challenge_id} not found")
            
            # Get updated challenge
            updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            
            return self._challenge_to_response(updated_challenge)
            
        except Exception as e:
            logger.error(f"Failed to update challenge {challenge_id}: {e}")
            raise RuntimeError(f"Failed to update challenge: {e}")
    
    async def delete_challenge(self, challenge_id: str) -> bool:
        """Delete a challenge and all its instances"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            # Get challenge first
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                return False
            
            # Stop all instances if running
            if challenge["status"] == ChallengeStatus.RUNNING:
                await self.stop_challenge(challenge_id, remove_instances=True)
            
            # Delete from database
            result = await challenges.delete_one({"_id": ObjectId(challenge_id)})
            
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Failed to delete challenge {challenge_id}: {e}")
            raise RuntimeError(f"Failed to delete challenge: {e}")
    
    async def get_team_access_info(self, challenge_id: str, team_id: str) -> Optional[Dict]:
        """Get access information for a specific team"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                return None
            
            # Find team instance
            team_instance = None
            for instance in challenge.get("instances", []):
                if instance["team_id"] == team_id:
                    team_instance = instance
                    break
            
            if not team_instance:
                return None
            
            # Build access info
            ports = challenge["config"].get("ports", [5000])
            access_url = f"http://{team_instance['public_ip']}:{ports[0]}"
            
            return {
                "team_id": team_id,
                "challenge_name": challenge["name"],
                "public_ip": team_instance["public_ip"],
                "ports": ports,
                "status": team_instance["status"],
                "access_url": access_url
            }
            
        except Exception as e:
            logger.error(f"Failed to get team access info: {e}")
            raise RuntimeError(f"Failed to get team access info: {e}")
    
    async def get_challenge_stats(self, challenge_id: str) -> Optional[Dict]:
        """Get statistics for a challenge"""
        try:
            db = await self._get_db()
            challenges = db["challenges"]
            
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                return None
            
            instances = challenge.get("instances", [])
            running_instances = sum(1 for i in instances if i["status"] == ChallengeStatus.RUNNING)
            failed_instances = sum(1 for i in instances if i["status"] == ChallengeStatus.FAILED)
            
            ip_allocation = {i["team_id"]: i["public_ip"] for i in instances}
            
            return {
                "total_instances": len(instances),
                "running_instances": running_instances,
                "failed_instances": failed_instances,
                "total_teams": challenge["total_teams"],
                "ip_allocation": ip_allocation
            }
            
        except Exception as e:
            logger.error(f"Failed to get challenge stats: {e}")
            raise RuntimeError(f"Failed to get challenge stats: {e}")
    
    def _challenge_to_response(self, challenge: Dict) -> ChallengeResponse:
        """Convert challenge document to response schema"""
        instances = []
        for instance in challenge.get("instances", []):
            instances.append(ChallengeInstanceSchema(
                team_id=instance["team_id"],
                instance_id=instance["instance_id"],
                public_ip=instance["public_ip"],
                internal_ip=instance["internal_ip"],
                status=ChallengeStatus(instance["status"]),
                created_at=instance["created_at"],
                pod_name=instance["pod_name"],
                service_name=instance["service_name"],
                namespace=instance["namespace"]
            ))
        
        return ChallengeResponse(
            id=str(challenge["_id"]),
            name=challenge["name"],
            description=challenge["description"],
            config=challenge["config"],
            total_teams=challenge["total_teams"],
            is_active=challenge["is_active"],
            status=ChallengeStatus(challenge["status"]),
            instances=instances,
            created_at=challenge["created_at"],
            updated_at=challenge["updated_at"],
            created_by=challenge["created_by"]
        )


# Global instance
challenge_service = ChallengeService()
