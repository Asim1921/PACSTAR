import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from bson import ObjectId

# Import will be handled dynamically to avoid circular imports
from app.schemas.challenge import (
    ChallengeCreate,
    ChallengeUpdate,
    ChallengeResponse,
    ChallengeStatus,
    ChallengeInstance as ChallengeInstanceSchema,
    ChallengeMode,
    ArchitectureType,
)
from app.db.models.challenge import Challenge, ChallengeInstance
from app.services.kubernetes_service import kubernetes_service

logger = logging.getLogger(__name__)


class ChallengeService:
    """Service for managing challenges and their Kubernetes deployments"""
    
    def __init__(self):
        self.k8s_service = kubernetes_service
        self._challenge_collection = None
        self._challenge_instance_collection = None
        self._submissions_collection = None

    def _resolve_architecture(self, challenge: Dict) -> str:
        """Normalize architecture to kubernetes|openstack."""
        config = challenge.get("config", {}) if isinstance(challenge, dict) else {}
        arch = config.get("architecture") or challenge.get("challenge_category")
        if arch in [ArchitectureType.OPENSTACK, "openstack"]:
            return "openstack"
        return "kubernetes"

    def _resolve_mode(self, challenge: Dict) -> str:
        """Return static|dynamic|multi_flag mode."""
        config = challenge.get("config", {}) if isinstance(challenge, dict) else {}
        mode = config.get("mode")
        if isinstance(mode, ChallengeMode):
            return mode.value
        if mode:
            return mode
        # Legacy fallback: static category -> static
        category = challenge.get("challenge_category")
        if category == "static":
            return "static"
        return "dynamic"
    
    async def _get_collections(self):
        """Get database collections"""
        if self._challenge_collection is None:
            from app.db.init_db import get_database
            db = await get_database()
            if db is None:
                raise RuntimeError("Database connection failed")
            self._challenge_collection = db["challenges"]
            self._challenge_instance_collection = db["challenge_instances"]
            self._submissions_collection = db["submissions"]
        return self._challenge_collection, self._challenge_instance_collection
    
    async def create_challenge(self, challenge_data: ChallengeCreate, created_by: str) -> ChallengeResponse:
        """Create a new challenge"""
        try:
            # Get collections
            challenges, _ = await self._get_collections()
            
            # Debug logging
            logger.info(f"Creating challenge with category: {challenge_data.challenge_category}")
            
            # Derive architecture/mode into legacy challenge_category for backward compatibility
            config_dict = challenge_data.config.model_dump()
            arch = config_dict.get("architecture")
            mode = config_dict.get("mode")
            if arch in [ArchitectureType.OPENSTACK, "openstack"]:
                derived_category = "openstack"
            elif mode in [ChallengeMode.STATIC, "static"]:
                derived_category = "static"
            else:
                derived_category = "containerized"

            # Create challenge document
            challenge_doc = {
                "name": challenge_data.name,
                "description": challenge_data.description,
                "challenge_category": derived_category,
                "config": config_dict,
                "flag": getattr(challenge_data, "flag", None),
                "flags": getattr(challenge_data, "flags", None),
                "points": getattr(challenge_data, "points", 100),
                "total_teams": challenge_data.total_teams,
                "is_active": challenge_data.is_active,
                "allowed_teams": challenge_data.allowed_teams if hasattr(challenge_data, 'allowed_teams') and challenge_data.allowed_teams else None,
                "status": ChallengeStatus.PENDING,
                "instances": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": created_by
            }
            
            # Verify category before saving
            logger.info(f"Challenge doc category before save: {challenge_doc['challenge_category']}")
            
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
                created_by=str(created_by)
            )
            
        except Exception as e:
            logger.error(f"Failed to create challenge: {e}")
            raise RuntimeError(f"Failed to create challenge: {e}")
    
    async def deploy_challenge(self, challenge_id: str, force_redeploy: bool = False) -> ChallengeResponse:
        """Deploy a challenge to Kubernetes"""
        try:
            # Get collections
            challenges, _ = await self._get_collections()
            
            # Get challenge from database
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                raise ValueError(f"Challenge {challenge_id} not found")
            
            mode = self._resolve_mode(challenge)
            architecture = self._resolve_architecture(challenge)

            # Check if already deployed
            if challenge["status"] == ChallengeStatus.RUNNING and not force_redeploy:
                raise ValueError("Challenge is already running. Use force_redeploy=True to redeploy.")

            # Static challenge: only create download links, no infra
            if mode == "static":
                try:
                    instances: List[Dict[str, Any]] = []
                    for team_num in range(1, challenge["total_teams"] + 1):
                        team_id = f"team-{team_num:03d}"
                        result = await self._deploy_static_challenge_for_team(challenge, team_id)
                        instances = result.get("instances", instances)
                    # Update status
                    await challenges.update_one(
                        {"_id": ObjectId(challenge_id)},
                        {
                            "$set": {
                                "status": ChallengeStatus.RUNNING if instances else ChallengeStatus.FAILED,
                                "updated_at": datetime.utcnow(),
                                "instances": instances,
                            }
                        },
                    )
                    updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
                    return self._challenge_to_response(updated_challenge)
                except Exception as e:
                    logger.error(f"Failed to deploy static challenge: {e}")
                    raise

            # OpenStack architecture: use Heat deployments per team
            if architecture == "openstack":
                for team_num in range(1, challenge["total_teams"] + 1):
                    team_id = f"team-{team_num:03d}"
                    try:
                        await self._deploy_openstack_challenge_for_team(
                            challenge_id,
                            challenge,
                            team_id,
                            force_redeploy,
                            reset_by_username=None,
                        )
                    except Exception as e:
                        logger.error(f"Failed to deploy OpenStack instance for team {team_id}: {e}")
                        continue
                updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
                return self._challenge_to_response(updated_challenge)

            # Kubernetes/containerized path
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
            try:
                challenges, _ = await self._get_collections()
                await challenges.update_one(
                    {"_id": ObjectId(challenge_id)},
                    {
                        "$set": {
                            "status": ChallengeStatus.FAILED,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
            except Exception as update_error:
                logger.error(f"Failed to update challenge status to failed: {update_error}")
            raise RuntimeError(f"Failed to deploy challenge: {e}")
    
    async def deploy_challenge_for_team(
        self, 
        challenge_id: str, 
        team_id: str, 
        force_redeploy: bool = False,
        reset_by_username: Optional[str] = None
    ) -> ChallengeResponse:
        """Deploy a challenge instance for a specific team only"""
        print(f"🚀🚀🚀 deploy_challenge_for_team CALLED! challenge_id={challenge_id}, team_id={team_id}", flush=True)
        try:
            challenges, _ = await self._get_collections()
            print(f"✅ Got collections", flush=True)
            
            # Get challenge from database
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                raise ValueError(f"Challenge {challenge_id} not found")
            print(f"✅ Found challenge: {challenge.get('name')}", flush=True)
            
            # Check if challenge is active
            if not challenge.get("is_active", False):
                raise ValueError("Challenge is not active")
            
            # Check if team_id is within valid range
            # Note: Real teams (with team_code) use hash-based IDs (e.g., team-690193a1)
            # Zone-based teams use sequential IDs (e.g., team-001, team-002)
            # Only validate sequential format against total_teams
            total_teams = challenge.get("total_teams", 0)
            import re
            
            # Check if team_id matches sequential format (team-001, team-002, etc.)
            # Sequential format: team- followed by exactly 3 digits
            match = re.match(r"team-(\d{3})$", team_id)
            if match:
                # Sequential format - validate against total_teams
                team_num = int(match.group(1))
                if team_num < 1 or team_num > total_teams:
                    raise ValueError(f"Team {team_id} is out of range (max teams: {total_teams})")
            else:
                # Non-sequential format (e.g., team-690193a1 from real team hash)
                # Allow it - real teams can deploy regardless of total_teams
                # total_teams only limits sequential deployments (for zone-based teams)
                # Just log a warning if we exceed suggested limit
                existing_instances = challenge.get("instances", [])
                if len(existing_instances) >= total_teams:
                    logger.info(f"Real team {team_id} deploying instance. {len(existing_instances)} instances exist (suggested max: {total_teams}, but real teams are allowed)")
                # Allow deployment for real teams - no restriction
            
            # Check challenge category and route accordingly
            mode = self._resolve_mode(challenge)
            architecture = self._resolve_architecture(challenge)
            print(f"📋 Challenge mode: {mode} | architecture: {architecture}", flush=True)
            
            if mode == "static":
                print(f"🔄 Deploying STATIC challenge...", flush=True)
                # Handle static challenge - provide download link instead of deploying
                result = await self._deploy_static_challenge_for_team(challenge, team_id)
                # Convert to ChallengeResponse
                return await self._challenge_to_response(challenge, result["instances"])
            elif architecture == "openstack":
                print(f"🔄 Deploying OPENSTACK challenge...", flush=True)
                # Handle OpenStack challenge - deploy using Heat template
                result = await self._deploy_openstack_challenge_for_team(
                    challenge_id, challenge, team_id, force_redeploy, reset_by_username
                )
                print(f"✅ OpenStack deployment result received", flush=True)
                return result
            
            # Get existing instances (for containerized challenges)
            existing_instances = challenge.get("instances", [])
            existing_instance = next(
                (inst for inst in existing_instances if inst.get("team_id") == team_id), 
                None
            )
            
            if existing_instance and not force_redeploy:
                if existing_instance.get("status") == ChallengeStatus.RUNNING:
                    raise ValueError(f"Instance for {team_id} is already running. Use force_redeploy=True to redeploy.")
                # If instance exists but is not running, we can redeploy it
            
            # Create namespace if not exists
            namespace = await self.k8s_service.create_challenge_namespace(challenge["name"])
            
            try:
                # If redeploying, stop existing instance first
                if existing_instance and force_redeploy:
                    try:
                        await self.k8s_service.stop_challenge_instance(
                            existing_instance["namespace"],
                            existing_instance["pod_name"],
                            existing_instance["service_name"],
                            team_id
                        )
                        logger.info(f"Stopped existing instance for team {team_id} before redeploy")
                    except Exception as stop_error:
                        logger.warning(f"Failed to stop existing instance: {stop_error}, continuing with deployment")
                
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
                
                # Add reset information if this is a reset operation
                if force_redeploy and reset_by_username:
                    instance_doc["last_reset_by"] = reset_by_username
                    instance_doc["last_reset_at"] = datetime.utcnow()
                
                # Update or add instance to challenge
                if existing_instance:
                    # Update existing instance
                    updated_instances = [
                        inst if inst.get("team_id") != team_id else instance_doc
                        for inst in existing_instances
                    ]
                else:
                    # Add new instance
                    updated_instances = existing_instances + [instance_doc]
                
                # Determine overall challenge status
                running_count = sum(1 for inst in updated_instances if inst.get("status") == ChallengeStatus.RUNNING)
                challenge_status = ChallengeStatus.RUNNING if running_count > 0 else challenge.get("status", ChallengeStatus.PENDING)
                
                # Update challenge
                await challenges.update_one(
                    {"_id": ObjectId(challenge_id)},
                    {
                        "$set": {
                            "instances": updated_instances,
                            "status": challenge_status,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                logger.info(f"Deployed instance for team {team_id} with IP {instance_data['public_ip']}")
                
                # Get updated challenge
                updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
                return self._challenge_to_response(updated_challenge)
                
            except Exception as deploy_error:
                logger.error(f"Failed to deploy instance for team {team_id}: {deploy_error}")
                raise RuntimeError(f"Failed to deploy instance: {deploy_error}")
            
        except ValueError as e:
            raise
        except Exception as e:
            logger.error(f"Failed to deploy challenge for team: {e}")
            raise RuntimeError(f"Failed to deploy challenge for team: {e}")
    
    async def stop_challenge(self, challenge_id: str, remove_instances: bool = False) -> ChallengeResponse:
        """Stop a challenge and optionally remove all instances"""
        try:
            # Get collections
            challenges, _ = await self._get_collections()
            
            # Get challenge from database
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                raise ValueError(f"Challenge {challenge_id} not found")
            
            mode = self._resolve_mode(challenge)
            challenge_category = self._resolve_architecture(challenge)
            
            # Stop all instances based on challenge category
            for instance in challenge.get("instances", []):
                try:
                    if challenge_category == "openstack":
                        # For OpenStack challenges, delete Heat stacks
                        stack_id = instance.get("stack_id")
                        if stack_id:
                            try:
                                from app.services.openstack_service import openstack_service
                                if openstack_service.enabled:
                                    await self._delete_heat_stack(openstack_service, stack_id)
                                    logger.info(f"Deleted Heat stack {stack_id} for team {instance['team_id']}")
                                else:
                                    logger.warning(f"OpenStack service is disabled, cannot delete stack {stack_id}")
                            except Exception as stack_error:
                                logger.error(f"Failed to delete Heat stack {stack_id} for team {instance['team_id']}: {stack_error}")
                        else:
                            logger.warning(f"No stack_id found for OpenStack instance of team {instance['team_id']}")
                    else:
                        # For containerized challenges, use Kubernetes service
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
                # Clean up namespace (only for containerized challenges)
                if challenge_category != "openstack":
                    try:
                        for instance in challenge.get("instances", []):
                            if instance.get("namespace"):
                                await self.k8s_service.cleanup_challenge_namespace(instance["namespace"])
                                break  # Only need to cleanup once per challenge
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
            challenges, _ = await self._get_collections()
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
            challenges, _ = await self._get_collections()
            challenge_docs = await challenges.find().skip(skip).limit(limit).to_list(length=limit)
            
            return [self._challenge_to_response(challenge) for challenge in challenge_docs]
            
        except Exception as e:
            logger.error(f"Failed to list challenges: {e}")
            raise RuntimeError(f"Failed to list challenges: {e}")
    
    async def update_challenge(self, challenge_id: str, update_data: ChallengeUpdate) -> ChallengeResponse:
        """Update a challenge"""
        try:
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
                # derive category for backward compatibility
                arch = update_doc["config"].get("architecture")
                mode = update_doc["config"].get("mode")
                if arch == ArchitectureType.OPENSTACK or arch == "openstack":
                    update_doc["challenge_category"] = "openstack"
                elif mode == ChallengeMode.STATIC or mode == "static":
                    update_doc["challenge_category"] = "static"
                else:
                    update_doc["challenge_category"] = "containerized"
            if update_data.allowed_teams is not None:
                update_doc["allowed_teams"] = update_data.allowed_teams
            if getattr(update_data, "flag", None) is not None:
                update_doc["flag"] = update_data.flag
            if getattr(update_data, "flags", None) is not None:
                update_doc["flags"] = update_data.flags
            
            # Get collections
            challenges, _ = await self._get_collections()
            
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
        """Delete a challenge and all its instances (including OpenStack VMs and Heat stacks)"""
        try:
            # Get collections
            challenges, _ = await self._get_collections()
            
            # Get challenge first
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                return False
            
            challenge_category = challenge.get("challenge_category", "containerized")
            
            # For OpenStack challenges, delete all Heat stacks first (before stopping)
            # This ensures stacks are deleted even if challenge is not in RUNNING status
            if challenge_category == "openstack":
                from app.services.openstack_service import openstack_service
                if openstack_service.enabled:
                    instances = challenge.get("instances", [])
                    for instance in instances:
                        stack_id = instance.get("stack_id")
                        if stack_id:
                            try:
                                await self._delete_heat_stack(openstack_service, stack_id)
                                logger.info(f"Deleted Heat stack {stack_id} for team {instance.get('team_id', 'unknown')} during challenge deletion")
                            except Exception as stack_error:
                                logger.error(f"Failed to delete Heat stack {stack_id}: {stack_error}")
                                # Continue with deletion even if stack deletion fails
                        else:
                            server_id = instance.get("server_id")
                            if server_id:
                                logger.warning(f"Instance has server_id {server_id} but no stack_id - stack may already be deleted")
                else:
                    logger.warning(f"OpenStack service is disabled, cannot delete stacks for challenge {challenge_id}")
            
            # Stop all instances if running (this will also clean up resources)
            # For OpenStack, stacks are already deleted above, but stop_challenge will handle any remaining cleanup
            if challenge["status"] == ChallengeStatus.RUNNING:
                await self.stop_challenge(challenge_id, remove_instances=True)
            
            # Delete from database
            result = await challenges.delete_one({"_id": ObjectId(challenge_id)})
            
            if result.deleted_count > 0:
                logger.info(f"Successfully deleted challenge {challenge_id} and all associated resources")
            
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Failed to delete challenge {challenge_id}: {e}")
            raise RuntimeError(f"Failed to delete challenge: {e}")
    
    async def get_team_access_info(self, challenge_id: str, team_id: str) -> Optional[Dict]:
        """Get access information for a specific team"""
        try:
            challenges, _ = await self._get_collections()
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
            challenges, _ = await self._get_collections()
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
        challenge_category = challenge.get("challenge_category", "containerized")
        
        for instance in challenge.get("instances", []):
            # Check challenge category from instance or challenge
            instance_category = instance.get("challenge_category") or challenge_category
            
            if instance_category == "static":
                # Static challenge instances have download_url instead of public_ip
                download_url = instance.get("download_url", instance.get("public_ip", "N/A"))
                instances.append(ChallengeInstanceSchema(
                    team_id=instance["team_id"],
                    instance_id=instance["instance_id"],
                    public_ip=download_url,  # Use download_url as public_ip for static
                    internal_ip="N/A",  # Static challenges don't have internal IPs
                    status=ChallengeStatus(instance["status"]),
                    created_at=instance["created_at"],
                    pod_name=None,  # Static challenges don't have pods
                    service_name=None,  # Static challenges don't have services
                    namespace=None,  # Static challenges don't have namespaces
                    stack_id=None,
                    stack_name=None,
                    server_id=None,
                    network_id=None,
                    auto_delete_at=instance.get("auto_delete_at"),
                    last_reset_by=instance.get("last_reset_by"),
                    last_reset_at=instance.get("last_reset_at")
                ))
            elif instance_category == "openstack":
                # OpenStack challenge instances have stack_id and server_id
                instances.append(ChallengeInstanceSchema(
                    team_id=instance["team_id"],
                    instance_id=instance["instance_id"],
                    public_ip=instance.get("public_ip", "Pending"),
                    internal_ip=instance.get("internal_ip", "N/A"),
                    status=ChallengeStatus(instance["status"]),
                    created_at=instance["created_at"],
                    pod_name=None,  # OpenStack challenges don't have pods
                    service_name=None,  # OpenStack challenges don't have services
                    namespace=None,  # OpenStack challenges don't have namespaces
                    stack_id=instance.get("stack_id"),
                    stack_name=instance.get("stack_name"),
                    server_id=instance.get("server_id"),
                    network_id=instance.get("network_id"),
                    vnc_console_url=instance.get("vnc_console_url"),  # VNC console URL for OpenStack
                    auto_delete_at=instance.get("auto_delete_at"),
                    last_reset_by=instance.get("last_reset_by"),
                    last_reset_at=instance.get("last_reset_at")
                ))
            else:
                # Containerized challenge instances have public_ip and pod info
                instances.append(ChallengeInstanceSchema(
                    team_id=instance["team_id"],
                    instance_id=instance["instance_id"],
                    public_ip=instance["public_ip"],
                    internal_ip=instance["internal_ip"],
                    status=ChallengeStatus(instance["status"]),
                    created_at=instance["created_at"],
                    pod_name=instance.get("pod_name"),
                    service_name=instance.get("service_name"),
                    namespace=instance.get("namespace"),
                    stack_id=None,
                    stack_name=None,
                    server_id=None,
                    network_id=None,
                    auto_delete_at=None,
                    last_reset_by=instance.get("last_reset_by"),
                    last_reset_at=instance.get("last_reset_at")
                ))
        
        return ChallengeResponse(
            id=str(challenge["_id"]),
            name=challenge["name"],
            description=challenge["description"],
            config=challenge["config"],
            flag=challenge.get("flag"),
            flags=challenge.get("flags"),
            points=challenge.get("points", 100),
            total_teams=challenge["total_teams"],
            is_active=challenge["is_active"],
            allowed_teams=challenge.get("allowed_teams"),
            challenge_category=challenge.get("challenge_category", "containerized"),  # Include challenge_category
            status=ChallengeStatus(challenge["status"]),
            instances=instances,
            created_at=challenge["created_at"],
            updated_at=challenge["updated_at"],
            created_by=str(challenge["created_by"])
        )

    async def submit_flag(self, challenge_id: str, team_id: str, user_id: str, submitted_flag: str) -> Dict[str, Any]:
        """Validate submitted flag and award points if correct. Supports single and multi-flag."""
        challenges, _ = await self._get_collections()
        # Lazy init submissions if needed
        if self._submissions_collection is None:
            from app.db.init_db import get_database
            db = await get_database()
            self._submissions_collection = db["submissions"]

        challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
        if not challenge:
            raise ValueError("Challenge not found")
        if not challenge.get("is_active", False):
            raise ValueError("Challenge is not active")

        mode = self._resolve_mode(challenge)
        flags_list = challenge.get("flags") or challenge.get("config", {}).get("flags") or []

        # Multi-flag flow
        if mode == "multi_flag" and flags_list:
            trimmed = submitted_flag.strip()
            points_total = int(challenge.get("points", 100))
            points_per_flag = max(1, points_total // max(len(flags_list), 1))

            # Check each flag; support partial credit and prevent duplicate per flag_name
            for flag_item in flags_list:
                name = flag_item.get("name") or "default"
                value = flag_item.get("value")
                if not value:
                    continue  # dynamic flags may not store value; cannot validate here

                # Prevent duplicate solves for this flag
                existing = await self._submissions_collection.find_one({
                    "challenge_id": ObjectId(challenge_id),
                    "team_id": team_id,
                    "flag_name": name
                })
                if existing:
                    continue

                if trimmed == str(value).strip():
                    doc = {
                        "challenge_id": ObjectId(challenge_id),
                        "team_id": team_id,
                        "user_id": str(user_id),
                        "points": points_per_flag,
                        "submitted_at": datetime.utcnow(),
                        "flag_name": name
                    }
                    await self._submissions_collection.insert_one(doc)
                    return {"status": "correct", "points": points_per_flag, "flag": name}

            return {"status": "incorrect", "points": 0}

        # Single-flag (legacy/dynamic)
        correct_flag = challenge.get("flag")
        if not correct_flag:
            # fallback to config.flags[0] if present
            if flags_list:
                correct_flag = flags_list[0].get("value")
        if not correct_flag:
            raise ValueError("Challenge does not have a flag configured")

        # Prevent duplicate solves for the same team and challenge
        existing = await self._submissions_collection.find_one({
            "challenge_id": ObjectId(challenge_id),
            "team_id": team_id
        })
        if existing:
            return {"status": "already_solved", "points": 0}

        if submitted_flag.strip() != str(correct_flag).strip():
            return {"status": "incorrect", "points": 0}

        points = int(challenge.get("points", 100))
        doc = {
            "challenge_id": ObjectId(challenge_id),
            "team_id": team_id,
            "user_id": str(user_id),
            "points": points,
            "submitted_at": datetime.utcnow()
        }
        await self._submissions_collection.insert_one(doc)

        return {"status": "correct", "points": points}

    async def get_scoreboard(self) -> List[Dict[str, Any]]:
        """Compute simple team scoreboard from submissions: total points and solves per team."""
        # Ensure submissions collection exists
        if self._submissions_collection is None:
            from app.db.init_db import get_database
            db = await get_database()
            self._submissions_collection = db["submissions"]

        pipeline = [
            {"$group": {"_id": "$team_id", "points": {"$sum": "$points"}, "solves": {"$sum": 1}}},
            {"$sort": {"points": -1, "solves": -1, "_id": 1}}
        ]
        results = await self._submissions_collection.aggregate(pipeline).to_list(length=1000)
        # Map to expected structure
        scoreboard = [{"team_id": r["_id"], "points": r["points"], "solves": r["solves"]} for r in results]
        return scoreboard


    async def _deploy_static_challenge_for_team(self, challenge: Dict, team_id: str) -> Dict[str, Any]:
        """Deploy static challenge for a team (provide download link)"""
        try:
            # Check if team already has access
            existing_instances = challenge.get("instances", [])
            existing_instance = next(
                (inst for inst in existing_instances if inst.get("team_id") == team_id), 
                None
            )
            
            if existing_instance:
                return {
                    "message": f"Static challenge access for team {team_id} already granted",
                    "instances": existing_instances
                }
            
            # Create download link for static challenge
            config = challenge.get("config", {})
            file_name = config.get("file_name", "challenge_file")
            file_id = config.get("file_id", "unknown")
            
            # If file_id is still unknown, try to get it from download_url
            if file_id == "unknown" and config.get("download_url"):
                download_url = config.get("download_url", "")
                if "/download/" in download_url:
                    file_id = download_url.split("/download/")[-1]
            
            # Create public download URL using the new serve endpoint
            # Get server IP from environment or use localhost
            import os
            server_ip = os.getenv("SERVER_IP", "192.168.250.178")  # Default to your server IP
            server_port = os.getenv("SERVER_PORT", "8000")  # Default to your server port
            download_url = f"http://{server_ip}:{server_port}/api/v1/files/serve/{file_id}"
            
            # Create instance data for static challenge
            instance_data = {
                "instance_id": f"{challenge['_id']}-{team_id}",
                "team_id": team_id,
                "status": "running",
                "download_url": download_url,
                "file_name": file_name,
                "created_at": datetime.utcnow(),
                "challenge_category": "static"
            }
            
            # Update challenge with new instance
            challenges, _ = await self._get_collections()
            await challenges.update_one(
                {"_id": challenge["_id"]},
                {"$push": {"instances": instance_data}}
            )
            
            # Get updated instances
            updated_challenge = await challenges.find_one({"_id": challenge["_id"]})
            instances = updated_challenge.get("instances", [])
            
            return {
                "message": f"Static challenge access granted for team {team_id}",
                "instances": instances
            }
            
        except Exception as e:
            logger.error(f"Error deploying static challenge for team: {str(e)}")
            raise ValueError(f"Failed to deploy static challenge for team: {str(e)}")
    
    async def _deploy_openstack_challenge_for_team(
        self,
        challenge_id: str,
        challenge: Dict,
        team_id: str,
        force_redeploy: bool = False,
        reset_by_username: Optional[str] = None
    ) -> ChallengeResponse:
        """Deploy OpenStack challenge for a team using Heat template"""
        print(f"🚀🚀🚀 ========== _deploy_openstack_challenge_for_team CALLED ==========", flush=True)
        print(f"📋 Challenge ID: {challenge_id}", flush=True)
        print(f"👥 Team ID: {team_id}", flush=True)
        print(f"🔄 Force redeploy: {force_redeploy}", flush=True)
        try:
            import asyncio
            from app.services.openstack_service import openstack_service
            from app.services.team_service import team_service
            
            # Check if OpenStack is enabled
            print(f"🔍 Checking OpenStack service status...", flush=True)
            if not openstack_service.enabled:
                print(f"❌ OpenStack integration is disabled!", flush=True)
                raise RuntimeError("OpenStack integration is not enabled. Please configure OpenStack settings.")
            print(f"✅ OpenStack service is enabled", flush=True)
            
            # Get Heat template from challenge config
            config = challenge.get("config", {})
            heat_template = config.get("heat_template")
            if not heat_template:
                raise ValueError("Heat template is required for OpenStack challenges")
            
            # Get team info for naming
            teams = await team_service.list_teams(limit=1000)
            team_info = next((t for t in teams if str(t.get("id") or t.get("_id")) == team_id), None)
            team_name = team_info.get("name", team_id) if team_info else team_id
            
            # Generate stack name based on team name and challenge name
            challenge_name = challenge.get("name", "challenge")
            # Sanitize names for OpenStack (alphanumeric and hyphens only)
            import re
            sanitized_team_name = re.sub(r'[^a-zA-Z0-9-]', '-', team_name).lower()[:50]
            sanitized_challenge_name = re.sub(r'[^a-zA-Z0-9-]', '-', challenge_name).lower()[:50]
            stack_name = f"{sanitized_challenge_name}-{sanitized_team_name}"
            
            # Get existing instances
            challenges, _ = await self._get_collections()
            existing_instances = challenge.get("instances", [])
            existing_instance = next(
                (inst for inst in existing_instances if inst.get("team_id") == team_id),
                None
            )
            
            if existing_instance and not force_redeploy:
                if existing_instance.get("status") == ChallengeStatus.RUNNING:
                    raise ValueError(f"Instance for {team_id} is already running. Use force_redeploy=True to redeploy.")
            
            # Prepare Heat template parameters
            heat_params = config.get("heat_template_parameters", {}).copy()
            # Override with team-specific values
            heat_params.setdefault("server_name", stack_name)
            
            # Network handling: Always use an existing network
            # Always default to "private" which exists in OpenStack, unless explicitly overridden
            from app.core.config import settings
            
            # Get default network from config or use "private"
            default_network = getattr(settings, "OPENSTACK_DEFAULT_NETWORK_ID", None) or "private"
            
            # Check if network is specified in template params
            if "network" in heat_params:
                specified_network = heat_params["network"]
                # Validate it's not a team-specific auto-generated network name that likely doesn't exist
                # Pattern: "team-xxx-network" where xxx is team identifier
                # Known good networks: "private", "public", "team1" (without "-network" suffix)
                network_lower = specified_network.lower() if specified_network else ""
                
                # Check for auto-generated team network pattern (ends with "-network" and contains team name)
                if network_lower and network_lower.endswith("-network") and ("team" in network_lower or len(network_lower.split("-")) > 2):
                    # This looks like an auto-generated team network - use default instead
                    logger.warning(f"Auto-generated team network '{specified_network}' likely doesn't exist. Using default '{default_network}' instead.")
                    heat_params["network"] = default_network
                elif network_lower in ["private", "public", "team1"]:
                    # Known good networks - use them
                    logger.info(f"Using known good network from template params: {specified_network} for team {team_id}")
                else:
                    # Other network specified - use it (may fail if doesn't exist, but user explicitly set it)
                    logger.info(f"Using network from template params: {specified_network} for team {team_id}")
            else:
                # Not specified - use default
                heat_params["network"] = default_network
                logger.info(f"Using default network '{default_network}' for team {team_id}")
            
            # Ensure external_network parameter is set for floating IP allocation
            if "external_network" not in heat_params:
                # Use "public" as default external network for floating IPs
                heat_params["external_network"] = "public"
                logger.info(f"Using default external network 'public' for floating IP allocation")
            
            # If redeploying, delete existing stack first
            if existing_instance and force_redeploy:
                if existing_instance.get("stack_id"):
                    try:
                        await self._delete_heat_stack(openstack_service, existing_instance["stack_id"])
                        logger.info(f"Deleted existing stack {existing_instance['stack_id']} for team {team_id}")
                    except Exception as delete_error:
                        logger.warning(f"Failed to delete existing stack: {delete_error}, continuing with deployment")
            
            # Deploy Heat template
            print(f"🚀 Starting Heat stack deployment: {stack_name}", flush=True)
            print(f"📋 Stack parameters: {heat_params}", flush=True)
            stack_result = await openstack_service.deploy_heat_template(
                stack_name=stack_name,
                template_body=heat_template,
                template_url=None,
                parameters=heat_params,
                timeout_minutes=30,
                rollback_on_failure=True
            )
            
            stack_id = stack_result.get("stack_id") or stack_result.get("stack_name")
            print(f"✅ Heat stack deployment initiated. Stack ID: {stack_id}", flush=True)
            print(f"📊 Stack result: {stack_result}", flush=True)
            
            # Check if we already have server_id from the initial stack result
            # NOTE: server_id must be a valid UUID, not a resource name like "challenge_server"
            server_id = None
            floating_ip_from_outputs = None
            
            initial_outputs = stack_result.get("outputs", [])
            if initial_outputs:
                print(f"📋 Checking initial stack outputs: {len(initial_outputs)} outputs", flush=True)
                for output in initial_outputs:
                    output_key = output.get("output_key") or output.get("key")
                    output_value = output.get("output_value") or output.get("value")
                    print(f"🔍 Initial output: {output_key} = {output_value}", flush=True)
                    # Only accept server_id if it looks like a UUID (contains hyphens and is 36 chars)
                    if output_key == "server_id" and output_value and len(str(output_value)) == 36 and '-' in str(output_value):
                        server_id = output_value
                        print(f"✅ Found valid server_id (UUID) in initial outputs: {server_id}", flush=True)
                    elif output_key == "floating_ip" and output_value:
                        floating_ip_from_outputs = output_value
                        print(f"✅ Found floating_ip in initial outputs: {floating_ip_from_outputs}", flush=True)
            
            # If we have a valid server_id UUID, skip waiting for stack completion
            if server_id:
                print(f"✅ Already have valid server_id UUID from initial outputs: {server_id} - skipping stack wait!", flush=True)
            else:
                print(f"⏳ No valid server_id UUID yet (got resource name instead of UUID) - waiting for stack to complete...", flush=True)
                # Get stack outputs to extract server information
                conn = openstack_service._get_connection()
                print(f"🔗 Connected to OpenStack. Checking stack status...", flush=True)
                
                # Wait for stack to be complete and have outputs (stack might still be creating)
                import asyncio
                max_stack_wait = 120  # 120 seconds max wait for stack outputs
                stack_wait_interval = 3  # Check every 3 seconds
                stack_waited = 0
                stack = None
                
                print(f"⏳ Waiting for stack {stack_id} to complete and have outputs (max {max_stack_wait}s)...", flush=True)
                
                while stack_waited < max_stack_wait:
                    try:
                        print(f"🔍 Checking stack {stack_id} status (attempt {stack_waited//stack_wait_interval + 1}, waited {stack_waited}s)...", flush=True)
                        stack = conn.orchestration.get_stack(stack_id)
                        print(f"📊 Got stack object: {type(stack)}", flush=True)
                        
                        if not stack:
                            print(f"⚠️ Stack {stack_id} not found!", flush=True)
                            await asyncio.sleep(stack_wait_interval)
                            stack_waited += stack_wait_interval
                            continue
                        
                        stack_status = getattr(stack, 'stack_status', None) or getattr(stack, 'status', None)
                        print(f"📊 Stack {stack_id} status: {stack_status} (waited {stack_waited}s)", flush=True)
                        
                        if stack_status in ["CREATE_COMPLETE", "UPDATE_COMPLETE"]:
                            # Stack is complete, check for outputs
                            print(f"✅ Stack is COMPLETE! Checking outputs...", flush=True)
                            outputs = getattr(stack, 'outputs', None) or []
                            print(f"📋 Stack has {len(outputs)} outputs", flush=True)
                            
                            if outputs:
                                for output in outputs:
                                    output_key = output.get("output_key") or output.get("key")
                                    output_value = output.get("output_value") or output.get("value")
                                    print(f"🔍 Output: {output_key} = {output_value}", flush=True)
                                    
                                    if output_key == "server_id" and output_value:
                                        server_id = output_value
                                        print(f"✅ Found server_id in outputs: {server_id}", flush=True)
                                    elif output_key == "floating_ip" and output_value:
                                        floating_ip_from_outputs = output_value
                                        print(f"✅ Found floating IP in stack outputs: {floating_ip_from_outputs}", flush=True)
                                
                                if server_id:
                                    print(f"✅ Have server_id - proceeding!", flush=True)
                                    break
                            else:
                                print(f"⚠️ Stack complete but outputs list is empty!", flush=True)
                                break
                        elif stack_status in ["CREATE_IN_PROGRESS", "UPDATE_IN_PROGRESS"]:
                            print(f"⏳ Stack still creating... (status: {stack_status})", flush=True)
                        elif stack_status in ["CREATE_FAILED", "UPDATE_FAILED", "ROLLBACK_COMPLETE"]:
                            print(f"❌ Stack {stack_id} failed with status: {stack_status}", flush=True)
                            raise RuntimeError(f"Stack creation failed with status: {stack_status}")
                        else:
                            print(f"⚠️ Unknown stack status: {stack_status}", flush=True)
                            
                    except RuntimeError:
                        raise
                    except Exception as e:
                        print(f"❌ Error checking stack status ({stack_waited}/{max_stack_wait}s): {e}", flush=True)
                    
                    await asyncio.sleep(stack_wait_interval)
                    stack_waited += stack_wait_interval
            
            # If we still don't have server_id, try one more time
            if not server_id:
                print(f"⚠️ No server_id yet, trying to get from stack outputs...", flush=True)
                try:
                    conn = openstack_service._get_connection()
                    stack = conn.orchestration.get_stack(stack_id)
                    if stack and stack.outputs:
                        for output in stack.outputs:
                            if output.get("output_key") == "server_id" and not server_id:
                                server_id = output.get("output_value")
                                print(f"✅ Found server_id from stack outputs retry: {server_id}", flush=True)
                            elif output.get("output_key") == "floating_ip" and not floating_ip_from_outputs:
                                floating_ip_from_outputs = output.get("output_value")
                                if floating_ip_from_outputs:
                                    print(f"✅ Found floating IP in stack outputs (retry): {floating_ip_from_outputs}", flush=True)
                except Exception as e:
                    print(f"⚠️ Could not get stack outputs: {e}", flush=True)
            
            # Extract server ID and IP from stack outputs
            server_ip = floating_ip_from_outputs  # Use floating IP from outputs if we have it
            vnc_console_url = None
            network_id = heat_params.get("network", "private")  # Use network from parameters or default
            conn = openstack_service._get_connection()  # Ensure connection is available
            
            # If we have floating IP from outputs, use it immediately - no need to wait!
            if floating_ip_from_outputs:
                print(f"✅ Using floating IP from stack outputs immediately: {server_ip}", flush=True)
            
            print(f"🔍 Now getting server details. server_id={server_id}, server_ip={server_ip}", flush=True)
            
            # If server_id is available, get server details including IP and VNC console
            if server_id:
                try:
                    print(f"🔍 Getting server {server_id} from OpenStack...", flush=True)
                    # Quick check if server is already ACTIVE (don't wait if we already have floating IP)
                    server = conn.compute.get_server(server_id)
                    server_status = server.status if server else None
                    print(f"📊 Server status: {server_status}", flush=True)
                    
                    # Only wait for server to be ACTIVE if we don't already have floating IP
                    if not server_ip and server_status != "ACTIVE":
                        max_wait = 60  # 60 seconds max wait
                        wait_interval = 2  # Check every 2 seconds
                        waited = 0
                        
                        print(f"⏳ Waiting for server {server_id} to be ACTIVE (max {max_wait}s)...", flush=True)
                        while waited < max_wait:
                            server = conn.compute.get_server(server_id)
                            if server:
                                print(f"📊 Server {server_id} status: {server.status} (waited {waited}s)", flush=True)
                                if server.status == "ACTIVE":
                                    print(f"✅ Server is ACTIVE", flush=True)
                                    break
                                elif server.status in ["ERROR", "BUILD_FAILED"]:
                                    print(f"❌ Server {server_id} is in state {server.status}", flush=True)
                                    break
                            await asyncio.sleep(wait_interval)
                            waited += wait_interval
                    
                    print(f"🔍 Getting server details after ACTIVE...", flush=True)
                    server = conn.compute.get_server(server_id)
                    if server:
                        # If we already have floating IP from stack outputs, use it and skip waiting
                        floating_ip = floating_ip_from_outputs if floating_ip_from_outputs else None
                        
                        # Only wait for floating IP if we don't have it from outputs
                        if not floating_ip:
                            print(f"🔍 Floating IP not found in outputs, checking server addresses and network API...", flush=True)
                            # Wait for floating IP to be associated (it can take a few seconds after server is ACTIVE)
                            # Retry up to 30 seconds (10 attempts * 3 seconds)
                            max_floating_ip_wait = 30
                            floating_ip_wait_interval = 3  # Check every 3 seconds
                            floating_ip_waited = 0
                            
                            while floating_ip_waited < max_floating_ip_wait:
                                print(f"🔍 Attempting to find floating IP (waited {floating_ip_waited}s)...", flush=True)
                                # Method 2: Query OpenStack network API for floating IPs associated with this server
                                try:
                                    # Refresh server to get latest addresses
                                    server = conn.compute.get_server(server_id)
                                    server_addresses = getattr(server, "addresses", {})
                                    print(f"📋 Server addresses: {server_addresses}", flush=True)
                                    
                                    # Collect all fixed IPs from the server
                                    fixed_ips = []
                                    for network_name, network_addrs in server_addresses.items():
                                        if network_addrs:
                                            for addr_info in network_addrs:
                                                addr = addr_info.get("addr") if isinstance(addr_info, dict) else addr_info
                                                addr_type = addr_info.get("OS-EXT-IPS:type", "") if isinstance(addr_info, dict) else ""
                                                print(f"  📍 Address: {addr} (type: {addr_type}, network: {network_name})", flush=True)
                                                if addr and isinstance(addr, str) and "." in addr and ":" not in addr:
                                                    if addr_type == "floating":
                                                        # Found floating IP directly in addresses!
                                                        floating_ip = addr
                                                        print(f"✅ Found floating IP in server addresses: {floating_ip}", flush=True)
                                                        break
                                                    elif addr_type != "floating":
                                                        fixed_ips.append(addr)
                                            if floating_ip:
                                                break
                                    
                                    print(f"📋 Fixed IPs collected: {fixed_ips}", flush=True)
                                    
                                    # If not found in addresses, query network API
                                    if not floating_ip:
                                        print(f"🔍 Querying network API for floating IPs...", flush=True)
                                        floating_ips = list(conn.network.ips(floating_ip_address=None))
                                        print(f"📋 Found {len(floating_ips)} floating IPs in network API", flush=True)
                                        # Find floating IP that matches any fixed IP
                                        for fip in floating_ips:
                                            fip_addr = getattr(fip, 'floating_ip_address', None)
                                            fixed_addr = getattr(fip, 'fixed_ip_address', None)
                                            print(f"  📍 FIP: {fip_addr} -> Fixed: {fixed_addr}", flush=True)
                                            if fixed_addr and fixed_addr in fixed_ips:
                                                floating_ip = fip_addr
                                                print(f"✅ Found floating IP from network API: {floating_ip} (associated with fixed IP: {fixed_addr})", flush=True)
                                                break
                                    
                                    # Also check stack outputs again (might be updated)
                                    if not floating_ip:
                                        print(f"🔍 Checking stack outputs again...", flush=True)
                                        stack = conn.orchestration.get_stack(stack_id)
                                        if stack and stack.outputs:
                                            for output in stack.outputs:
                                                if output.get("output_key") == "floating_ip":
                                                    floating_ip = output.get("output_value")
                                                    if floating_ip:
                                                        print(f"✅ Found floating IP from refreshed stack outputs: {floating_ip}", flush=True)
                                                        break
                                    
                                    if floating_ip:
                                        break
                                        
                                except Exception as fip_error:
                                    print(f"⚠️ Could not query floating IPs (attempt {floating_ip_waited}/{max_floating_ip_wait}): {fip_error}", flush=True)
                                
                                if not floating_ip:
                                    await asyncio.sleep(floating_ip_wait_interval)
                                    floating_ip_waited += floating_ip_wait_interval
                                    print(f"⏳ Waiting for floating IP to be associated... ({floating_ip_waited}/{max_floating_ip_wait}s)", flush=True)
                        
                        # Method 3: Extract from server addresses (fallback) - check all IPs
                        # Only do this if we still don't have floating IP
                        if not floating_ip:
                            addresses = getattr(server, "addresses", {})
                            internal_ip = None
                            all_ips = []
                            
                            if addresses:
                                for network_name, network_addrs in addresses.items():
                                    if network_addrs:
                                        for addr_info in network_addrs:
                                            addr = addr_info.get("addr") if isinstance(addr_info, dict) else addr_info
                                            addr_type = addr_info.get("OS-EXT-IPS:type", "") if isinstance(addr_info, dict) else ""
                                            
                                            if addr and isinstance(addr, str) and "." in addr and ":" not in addr:
                                                all_ips.append((addr, network_name, addr_type))
                                                
                                                # Check if this is a floating IP
                                                if addr_type == "floating":
                                                    floating_ip = addr
                                                    logger.info(f"✅ Found floating IP from server addresses (type: floating): {addr}")
                                                    break
                                                elif network_name.lower() in ["public", "external", "ext-net"]:
                                                    # Likely floating IP on external network
                                                    floating_ip = addr
                                                    logger.info(f"✅ Found floating IP from server addresses (network: {network_name}): {addr}")
                                                    break
                                                elif addr.startswith("10.") or addr.startswith("172.16.") or addr.startswith("172.17.") or addr.startswith("172.18.") or addr.startswith("172.19.") or addr.startswith("172.20.") or addr.startswith("172.21.") or addr.startswith("172.22.") or addr.startswith("172.23.") or addr.startswith("172.24.") or addr.startswith("172.25.") or addr.startswith("172.26.") or addr.startswith("172.27.") or addr.startswith("172.28.") or addr.startswith("172.29.") or addr.startswith("172.30.") or addr.startswith("172.31.") or addr.startswith("192.168.0.") or addr.startswith("192.168.1."):
                                                    # This is likely an internal IP
                                                    if not internal_ip:
                                                        internal_ip = addr
                                                        logger.info(f"Found internal IP from server addresses (network: {network_name}): {addr}")
                                        if floating_ip:
                                            break
                                
                                # If we have internal IP in 10.x.x.x range, any other IP in different range is likely floating
                                if not floating_ip and internal_ip and all_ips:
                                    for addr, network_name, addr_type in all_ips:
                                        # If internal IP is 10.x.x.x, floating IP is likely 192.168.x.x (but not 192.168.0.x or 1.x)
                                        if internal_ip.startswith("10."):
                                            if addr.startswith("192.168.") and not addr.startswith("192.168.0.") and not addr.startswith("192.168.1.") and addr != internal_ip:
                                                floating_ip = addr
                                                logger.info(f"✅ Identified floating IP by range difference (internal: {internal_ip}, floating: {addr})")
                                                break
                                        # If internal IP is in private range, any public-looking IP is floating
                                        elif addr != internal_ip and not (addr.startswith("10.") or addr.startswith("172.16.") or addr.startswith("172.17.") or addr.startswith("172.18.") or addr.startswith("172.19.") or addr.startswith("172.20.") or addr.startswith("172.21.") or addr.startswith("172.22.") or addr.startswith("172.23.") or addr.startswith("172.24.") or addr.startswith("172.25.") or addr.startswith("172.26.") or addr.startswith("172.27.") or addr.startswith("172.28.") or addr.startswith("172.29.") or addr.startswith("172.30.") or addr.startswith("172.31.") or addr.startswith("192.168.0.") or addr.startswith("192.168.1.")):
                                            floating_ip = addr
                                            logger.info(f"✅ Identified floating IP by range difference (internal: {internal_ip}, floating: {addr})")
                                            break
                        
                        # Prioritize floating IP over internal IP
                        # First check if we got floating IP from stack outputs
                        print(f"🔍 Assigning server_ip. floating_ip={floating_ip}, internal_ip={internal_ip if 'internal_ip' in dir() else 'N/A'}", flush=True)
                        if floating_ip:
                            server_ip = floating_ip
                            print(f"✅ Using floating IP as public IP: {floating_ip}", flush=True)
                        elif 'internal_ip' in dir() and internal_ip:
                            server_ip = internal_ip
                            print(f"⚠️ Using internal IP as public IP (no floating IP found): {internal_ip}", flush=True)
                        else:
                            # Fallback: get first available IP from addresses
                            addresses = getattr(server, "addresses", {})
                            for network_addrs in addresses.values():
                                if network_addrs:
                                    addr_info = network_addrs[0]
                                    server_ip = addr_info.get("addr") if isinstance(addr_info, dict) else addr_info
                                    print(f"⚠️ Using first available IP as fallback: {server_ip}", flush=True)
                                    break
                        
                        # If we still don't have server_ip but have floating_ip_from_outputs, use it
                        if not server_ip and floating_ip_from_outputs:
                            server_ip = floating_ip_from_outputs
                            print(f"✅ Using floating IP from stack outputs as final fallback: {server_ip}", flush=True)
                        
                        print(f"📋 Final server_ip = {server_ip}", flush=True)
                        
                        # Get VNC console URL using direct API call (SDK uses newer API that may not work)
                        print(f"🔍 Getting VNC console URL...", flush=True)
                        vnc_retry_count = 0
                        max_vnc_retries = 3
                        vnc_retry_delay = 2
                        
                        while vnc_retry_count < max_vnc_retries and not vnc_console_url:
                            try:
                                print(f"🔍 VNC attempt {vnc_retry_count + 1}/{max_vnc_retries}...", flush=True)
                                
                                # Use direct API call with os-getVNCConsole (works on older OpenStack)
                                import requests
                                token = conn.auth_token
                                headers = {
                                    "X-Auth-Token": token,
                                    "Content-Type": "application/json"
                                }
                                
                                # Get compute endpoint
                                compute_url = "http://192.168.15.222:8774/v2.1"
                                
                                # Try os-getVNCConsole action
                                url = f"{compute_url}/servers/{server_id}/action"
                                data = {"os-getVNCConsole": {"type": "novnc"}}
                                
                                print(f"  Calling: POST {url}", flush=True)
                                response = requests.post(url, json=data, headers=headers, timeout=10)
                                print(f"  Response status: {response.status_code}", flush=True)
                                
                                if response.status_code == 200:
                                    result = response.json()
                                    print(f"  Response: {result}", flush=True)
                                    if 'console' in result and 'url' in result['console']:
                                        vnc_console_url = result['console']['url']
                                        print(f"✅ Retrieved VNC console URL: {vnc_console_url}", flush=True)
                                        break
                                else:
                                    print(f"  ⚠️ VNC API returned {response.status_code}: {response.text}", flush=True)
                                    
                            except Exception as vnc_error:
                                print(f"⚠️ VNC console attempt {vnc_retry_count + 1}/{max_vnc_retries} failed: {vnc_error}", flush=True)
                            
                            if not vnc_console_url and vnc_retry_count < max_vnc_retries - 1:
                                await asyncio.sleep(vnc_retry_delay)
                                vnc_retry_count += 1
                        
                        # Fallback: try to construct Horizon URL if SDK method fails
                        if not vnc_console_url:
                            try:
                                from app.core.config import settings
                                auth_url = str(getattr(settings, "OPENSTACK_AUTH_URL", ""))
                                if auth_url:
                                    import re
                                    url_match = re.match(r"(https?://[^:/]+)(?::\d+)?", auth_url)
                                    if url_match:
                                        base_url = url_match.group(1)
                                        # Try common Horizon ports
                                        for port in ["", ":80", ":443", ":8080"]:
                                            horizon_base = f"{base_url}{port}"
                                            vnc_console_url = f"{horizon_base}/project/instances/{server_id}/console"
                                            logger.info(f"⚠️ Constructed fallback Horizon console URL: {vnc_console_url}")
                                            break
                            except Exception as fallback_error:
                                logger.warning(f"Could not construct fallback VNC console URL: {fallback_error}")
                        
                except Exception as e:
                    print(f"❌ Could not fetch server details: {e}", flush=True)
                    import traceback
                    print(traceback.format_exc(), flush=True)
            
            print(f"📋 ========== FINAL RESULTS ==========", flush=True)
            print(f"📋 server_ip = {server_ip}", flush=True)
            print(f"📋 vnc_console_url = {vnc_console_url}", flush=True)
            print(f"📋 server_id = {server_id}", flush=True)
            print(f"📋 stack_id = {stack_id}", flush=True)
            
            # Calculate auto-delete time (1 hour from now)
            auto_delete_at = datetime.utcnow() + timedelta(hours=1)
            
            # Create instance document
            instance_doc = {
                "team_id": team_id,
                "instance_id": f"{challenge_id}-{team_id}",
                "public_ip": server_ip or "Pending",
                "internal_ip": "N/A",
                "status": ChallengeStatus.RUNNING,
                "created_at": datetime.utcnow(),
                "pod_name": None,
                "service_name": None,
                "namespace": None,
                "stack_id": stack_id,
                "stack_name": stack_name,
                "server_id": server_id,
                "network_id": network_id,
                "vnc_console_url": vnc_console_url,  # VNC console URL for OpenStack VMs
                "auto_delete_at": auto_delete_at,
                "challenge_category": "openstack"
            }
            print(f"📋 Instance doc created: {instance_doc}", flush=True)
            
            # Add reset information if this is a reset operation
            if force_redeploy and reset_by_username:
                instance_doc["last_reset_by"] = reset_by_username
                instance_doc["last_reset_at"] = datetime.utcnow()
            
            # Update or add instance to challenge
            if existing_instance:
                updated_instances = [
                    inst if inst.get("team_id") != team_id else instance_doc
                    for inst in existing_instances
                ]
            else:
                updated_instances = existing_instances + [instance_doc]
            
            # Determine overall challenge status
            running_count = sum(1 for inst in updated_instances if inst.get("status") == ChallengeStatus.RUNNING)
            challenge_status = ChallengeStatus.RUNNING if running_count > 0 else challenge.get("status", ChallengeStatus.PENDING)
            
            # Update challenge
            await challenges.update_one(
                {"_id": ObjectId(challenge_id)},
                {
                    "$set": {
                        "instances": updated_instances,
                        "status": challenge_status,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"Deployed OpenStack challenge for team {team_id} with stack {stack_name}")
            
            # Schedule auto-delete task (in production, use a proper task queue)
            # For now, we'll handle this in a background task
            asyncio.create_task(self._schedule_auto_delete(challenge_id, team_id, stack_id, auto_delete_at))
            
            # Get updated challenge
            updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            return self._challenge_to_response(updated_challenge)
            
        except Exception as e:
            logger.error(f"Failed to deploy OpenStack challenge for team {team_id}: {e}")
            raise RuntimeError(f"Failed to deploy OpenStack challenge: {str(e)}")
    
    async def _delete_heat_stack(self, openstack_service, stack_id: str):
        """Delete a Heat stack"""
        def _delete():
            conn = openstack_service._get_connection()
            conn.orchestration.delete_stack(stack_id)
            logger.info(f"Deleted Heat stack {stack_id}")
        
        await openstack_service._to_thread(_delete)
    
    async def _schedule_auto_delete(self, challenge_id: str, team_id: str, stack_id: str, delete_at: datetime):
        """Schedule auto-deletion of OpenStack instance after 1 hour"""
        # Calculate seconds until deletion
        now = datetime.utcnow()
        if delete_at > now:
            wait_seconds = (delete_at - now).total_seconds()
            await asyncio.sleep(wait_seconds)
        
        # Delete the stack
        try:
            from app.services.openstack_service import openstack_service
            challenges, _ = await self._get_collections()
            
            # Check if instance still exists
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if challenge:
                instances = challenge.get("instances", [])
                instance = next((inst for inst in instances if inst.get("team_id") == team_id), None)
                if instance and instance.get("stack_id") == stack_id:
                    await self._delete_heat_stack(openstack_service, stack_id)
                    
                    # Remove instance from challenge
                    updated_instances = [inst for inst in instances if inst.get("team_id") != team_id]
                    await challenges.update_one(
                        {"_id": ObjectId(challenge_id)},
                        {
                            "$set": {
                                "instances": updated_instances,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    logger.info(f"Auto-deleted OpenStack instance for team {team_id}")
        except Exception as e:
            logger.error(f"Failed to auto-delete OpenStack instance: {e}")
    
    async def reset_challenge_for_team(
        self,
        challenge_id: str,
        team_id: str,
        reset_type: str = "redeploy",
        reset_by_username: Optional[str] = None
    ) -> ChallengeResponse:
        """Reset challenge instance for a team. Supports restart/redeploy for OpenStack."""
        try:
            challenges, _ = await self._get_collections()
            challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            if not challenge:
                raise ValueError(f"Challenge {challenge_id} not found")
            
            challenge_category = challenge.get("challenge_category", "containerized")
            
            # Handle OpenStack reset
            if challenge_category == "openstack":
                return await self._reset_openstack_challenge(
                    challenge_id, challenge, team_id, reset_type, reset_by_username
                )
            else:
                # For containerized/static, use existing force_redeploy logic
                return await self.deploy_challenge_for_team(
                    challenge_id, team_id, force_redeploy=True, reset_by_username=reset_by_username
                )
                
        except Exception as e:
            logger.error(f"Failed to reset challenge for team: {e}")
            raise RuntimeError(f"Failed to reset challenge: {str(e)}")
    
    async def _reset_openstack_challenge(
        self,
        challenge_id: str,
        challenge: Dict,
        team_id: str,
        reset_type: str,
        reset_by_username: Optional[str]
    ) -> ChallengeResponse:
        """Reset OpenStack challenge: restart VM or redeploy"""
        try:
            from app.services.openstack_service import openstack_service
            
            existing_instances = challenge.get("instances", [])
            existing_instance = next(
                (inst for inst in existing_instances if inst.get("team_id") == team_id),
                None
            )
            
            if not existing_instance:
                raise ValueError(f"No instance found for team {team_id}")
            
            if reset_type == "restart":
                # Restart the VM
                server_id = existing_instance.get("server_id")
                if not server_id:
                    raise ValueError("Server ID not found for restart")
                
                def _restart_server():
                    conn = openstack_service._get_connection()
                    server = conn.compute.get_server(server_id)
                    conn.compute.reboot_server(server, reboot_type="SOFT")
                    logger.info(f"Restarted server {server_id} for team {team_id}")
                
                await openstack_service._to_thread(_restart_server)
                
                # Update reset info
                existing_instance["last_reset_by"] = reset_by_username
                existing_instance["last_reset_at"] = datetime.utcnow()
                
                challenges, _ = await self._get_collections()
                await challenges.update_one(
                    {"_id": ObjectId(challenge_id)},
                    {
                        "$set": {
                            "instances": existing_instances,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
            else:  # redeploy
                # Redeploy using Heat template (delete and recreate)
                return await self._deploy_openstack_challenge_for_team(
                    challenge_id, challenge, team_id, force_redeploy=True, reset_by_username=reset_by_username
                )
            
            # Get updated challenge
            challenges, _ = await self._get_collections()
            updated_challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
            return self._challenge_to_response(updated_challenge)
            
        except Exception as e:
            logger.error(f"Failed to reset OpenStack challenge: {e}")
            raise RuntimeError(f"Failed to reset OpenStack challenge: {str(e)}")


# Global instance
challenge_service = ChallengeService()
