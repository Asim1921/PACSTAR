"""
Mock Kubernetes Service for testing without actual Kubernetes cluster
"""
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import random
import string

logger = logging.getLogger(__name__)


class MockKubernetesService:
    """Mock service for managing Kubernetes deployments for challenges"""
    
    def __init__(self):
        # IP allocation strategy
        self.allocated_ips: Dict[str, str] = {}  # team_id -> ip
        self.available_ips: List[str] = []
        self._initialize_ip_pool()
        
        # Mock deployments tracking
        self.deployments: Dict[str, Dict] = {}  # namespace -> deployment info
    
    def _initialize_ip_pool(self):
        """Initialize IP pool for team allocation"""
        # Define a range of public IPs that can be allocated
        # In a real scenario, these would be actual public IPs from your cloud provider
        # For this implementation, we'll use a simulated range
        base_ip = "203.0.113.0"  # Example public IP range
        ip_network = f"{base_ip}/24"
        
        # Generate available IPs (simulating 100 IPs)
        for i in range(10, 110):  # 203.0.113.10 to 203.0.113.109
            self.available_ips.append(f"203.0.113.{i}")
        
        logger.info(f"Initialized mock IP pool with {len(self.available_ips)} available IPs")
    
    def _generate_unique_name(self, challenge_name: str, team_id: str) -> str:
        """Generate unique names for K8s resources"""
        # Sanitize names for Kubernetes (lowercase, alphanumeric, hyphens only)
        safe_challenge = challenge_name.lower().replace("_", "-").replace(" ", "-")
        safe_team = team_id.lower().replace("_", "-").replace(" ", "-")
        
        # Add random suffix to ensure uniqueness
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        
        return f"{safe_challenge}-{safe_team}-{random_suffix}"
    
    def _allocate_ip_for_team(self, team_id: str) -> str:
        """Allocate a unique public IP for a team"""
        if team_id in self.allocated_ips:
            return self.allocated_ips[team_id]
        
        if not self.available_ips:
            raise RuntimeError("No available IPs in the pool")
        
        # Allocate the first available IP
        allocated_ip = self.available_ips.pop(0)
        self.allocated_ips[team_id] = allocated_ip
        
        logger.info(f"Mock allocated IP {allocated_ip} for team {team_id}")
        return allocated_ip
    
    def _release_ip_for_team(self, team_id: str):
        """Release IP allocation for a team"""
        if team_id in self.allocated_ips:
            ip = self.allocated_ips[team_id]
            self.available_ips.append(ip)
            del self.allocated_ips[team_id]
            logger.info(f"Mock released IP {ip} for team {team_id}")
    
    async def create_challenge_namespace(self, challenge_name: str) -> str:
        """Create a namespace for the challenge (mock)"""
        # Sanitize challenge name to be Kubernetes-compliant
        import re
        sanitized = challenge_name.lower()
        # Replace spaces and underscores with hyphens
        sanitized = sanitized.replace(' ', '-').replace('_', '-')
        # Remove any characters that aren't alphanumeric or hyphens
        sanitized = re.sub(r'[^a-z0-9-]', '', sanitized)
        # Remove leading/trailing hyphens
        sanitized = sanitized.strip('-')
        # Replace multiple consecutive hyphens with single hyphen
        sanitized = re.sub(r'-+', '-', sanitized)
        # Limit length (Kubernetes namespace max is 63 characters)
        if len(sanitized) > 53:
            sanitized = sanitized[:53].rstrip('-')
        
        namespace_name = f"challenge-{sanitized}"
        
        # Mock namespace creation
        self.deployments[namespace_name] = {
            "name": namespace_name,
            "challenge_name": challenge_name,
            "created_at": datetime.utcnow(),
            "instances": {}
        }
        
        logger.info(f"Mock created namespace {namespace_name}")
        return namespace_name
    
    async def deploy_challenge_instance(
        self, 
        challenge_name: str, 
        team_id: str, 
        config: Dict, 
        namespace: str
    ) -> Dict:
        """Deploy a single challenge instance for a team (mock)"""
        
        # Allocate IP for the team
        public_ip = self._allocate_ip_for_team(team_id)
        
        # Generate unique names
        instance_name = self._generate_unique_name(challenge_name, team_id)
        pod_name = f"{instance_name}-pod"
        service_name = f"{instance_name}-svc"
        
        # Mock deployment
        instance_data = {
            "team_id": team_id,
            "instance_id": instance_name,
            "public_ip": public_ip,
            "internal_ip": f"10.244.1.{random.randint(1, 254)}",
            "pod_name": pod_name,
            "service_name": service_name,
            "namespace": namespace,
            "status": "running",
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Store in mock deployments
        if namespace in self.deployments:
            self.deployments[namespace]["instances"][team_id] = instance_data
        
        # Simulate deployment time
        await asyncio.sleep(0.1)  # Simulate deployment time
        
        logger.info(f"Mock deployed instance for team {team_id} with IP {public_ip}")
        
        return instance_data
    
    async def stop_challenge_instance(self, namespace: str, pod_name: str, service_name: str, team_id: str):
        """Stop a challenge instance (mock)"""
        try:
            # Mock stopping instance
            if namespace in self.deployments and team_id in self.deployments[namespace]["instances"]:
                del self.deployments[namespace]["instances"][team_id]
            
            # Release IP
            self._release_ip_for_team(team_id)
            
            logger.info(f"Mock stopped instance for team {team_id}")
            
        except Exception as e:
            logger.error(f"Mock failed to stop challenge instance: {e}")
            raise RuntimeError(f"Mock failed to stop challenge instance: {e}")
    
    async def get_challenge_status(self, namespace: str, pod_name: str) -> str:
        """Get status of a challenge instance (mock)"""
        # Mock status - always return running for simplicity
        return "running"
    
    async def cleanup_challenge_namespace(self, namespace: str):
        """Clean up entire challenge namespace (mock)"""
        try:
            if namespace in self.deployments:
                # Release all IPs for instances in this namespace
                for team_id in list(self.deployments[namespace]["instances"].keys()):
                    self._release_ip_for_team(team_id)
                
                # Remove namespace
                del self.deployments[namespace]
                
            logger.info(f"Mock deleted namespace {namespace}")
        except Exception as e:
            logger.error(f"Mock failed to cleanup namespace {namespace}: {e}")
            raise RuntimeError(f"Mock failed to cleanup namespace: {e}")


# Global instance
kubernetes_service = MockKubernetesService()
