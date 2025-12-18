import asyncio
import json
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import yaml
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import subprocess
import ipaddress
import random
import string

from app.core.config import settings

logger = logging.getLogger(__name__)


class KubernetesService:
    """Service for managing Kubernetes deployments for challenges"""
    
    def __init__(self):
        self.api_client = None
        self.apps_v1 = None
        self.core_v1 = None
        self.networking_v1 = None
        self.enabled = False  # Track if Kubernetes is available
        self._initialize_k8s_client()
        
        # IP allocation strategy
        self.allocated_ips: Dict[str, str] = {}  # team_id -> ip
        self.available_ips: List[str] = []
        self._initialize_ip_pool()
    
    def _ensure_enabled(self):
        """Check if Kubernetes is available"""
        if not self.enabled:
            raise RuntimeError("Kubernetes integration is not available. Please configure kubeconfig.")
    
    def _initialize_k8s_client(self):
        """Initialize Kubernetes client - gracefully handle missing config"""
        try:
            # Try to load in-cluster config first (if running in K8s)
            try:
                config.load_incluster_config()
                logger.info("Loaded in-cluster Kubernetes config")
            except:
                # Fallback to kubeconfig file
                config.load_kube_config()
                logger.info("Loaded kubeconfig file")
            
            self.api_client = client.ApiClient()
            self.apps_v1 = client.AppsV1Api()
            self.core_v1 = client.CoreV1Api()
            self.networking_v1 = client.NetworkingV1Api()
            self.enabled = True
            logger.info("Kubernetes client initialized successfully")
            
        except Exception as e:
            logger.warning(f"Kubernetes client not available: {e}")
            logger.warning("Kubernetes-based challenge deployments will be disabled")
            self.enabled = False
    
    def _initialize_ip_pool(self):
        """Initialize IP pool for team allocation"""
        # Use the actual MetalLB IP pool range
        base_ip = "192.168.250.100"  # Start of MetalLB pool
        ip_network = ipaddress.IPv4Network("192.168.250.100/30")  # 192.168.250.100-192.168.250.103
        
        # Generate available IPs from the MetalLB pool
        self.available_ips = [str(ip) for ip in ip_network.hosts()]
        
        logger.info(f"Initialized IP pool with {len(self.available_ips)} available IPs")
    
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
        
        logger.info(f"Allocated IP {allocated_ip} for team {team_id}")
        return allocated_ip
    
    def _release_ip_for_team(self, team_id: str):
        """Release IP allocation for a team"""
        if team_id in self.allocated_ips:
            ip = self.allocated_ips[team_id]
            self.available_ips.append(ip)
            del self.allocated_ips[team_id]
            logger.info(f"Released IP {ip} for team {team_id}")
    
    async def create_challenge_namespace(self, challenge_name: str) -> str:
        """Create a namespace for the challenge"""
        self._ensure_enabled()
        namespace_name = f"challenge-{challenge_name.lower().replace('_', '-')}"
        
        try:
            # Check if namespace already exists
            try:
                self.core_v1.read_namespace(name=namespace_name)
                logger.info(f"Namespace {namespace_name} already exists")
                return namespace_name
            except ApiException as e:
                if e.status != 404:
                    raise
            
            # Create namespace
            namespace = client.V1Namespace(
                metadata=client.V1ObjectMeta(
                    name=namespace_name,
                    labels={
                        "app": "challenge",
                        "challenge-name": challenge_name,
                        "managed-by": "pacstar"
                    }
                )
            )
            
            self.core_v1.create_namespace(body=namespace)
            logger.info(f"Created namespace {namespace_name}")
            return namespace_name
            
        except ApiException as e:
            logger.error(f"Failed to create namespace {namespace_name}: {e}")
            raise RuntimeError(f"Failed to create namespace: {e}")
    
    async def deploy_challenge_instance(
        self, 
        challenge_name: str, 
        team_id: str, 
        config: Dict, 
        namespace: str
    ) -> Dict:
        """Deploy a single challenge instance for a team"""
        self._ensure_enabled()
        
        # Allocate IP for the team
        public_ip = self._allocate_ip_for_team(team_id)
        
        # Generate unique names
        instance_name = self._generate_unique_name(challenge_name, team_id)
        pod_name = f"{instance_name}-pod"
        service_name = f"{instance_name}-svc"
        
        try:
            # Create deployment
            deployment = self._create_deployment(
                pod_name, challenge_name, team_id, config, namespace
            )
            
            # Create service with LoadBalancer type for public IP
            service = self._create_service(
                service_name, pod_name, config.get("ports", [5000]), 
                public_ip, namespace
            )
            
            # Apply resources
            deployment_result = self.apps_v1.create_namespaced_deployment(
                namespace=namespace, body=deployment
            )
            
            service_result = self.core_v1.create_namespaced_service(
                namespace=namespace, body=service
            )
            
            # Wait for deployment to be ready
            await self._wait_for_deployment_ready(namespace, pod_name)
            
            # Get internal IP
            internal_ip = await self._get_pod_internal_ip(namespace, pod_name)
            
            # Wait for LoadBalancer external IP to be assigned
            external_ip = await self._wait_for_loadbalancer_ip(namespace, service_name)
            
            return {
                "team_id": team_id,
                "instance_id": instance_name,
                "public_ip": external_ip,
                "internal_ip": internal_ip,
                "pod_name": pod_name,
                "service_name": service_name,
                "namespace": namespace,
                "status": "running",
                "created_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            # Release IP on failure
            self._release_ip_for_team(team_id)
            logger.error(f"Failed to deploy challenge instance for team {team_id}: {e}")
            raise RuntimeError(f"Failed to deploy challenge instance: {e}")
    
    def _create_deployment(self, pod_name: str, challenge_name: str, team_id: str, config: Dict, namespace: str):
        """Create Kubernetes deployment"""
        
        # Container spec
        container = client.V1Container(
            name=pod_name,
            image=config.get("image", "nginx:latest"),
            ports=[client.V1ContainerPort(container_port=port) for port in config.get("ports", [5000])],
            env=[
                client.V1EnvVar(name=k, value=v) 
                for k, v in config.get("environment_vars", {}).items()
            ],
            resources=client.V1ResourceRequirements(
                requests=config.get("resources", {}).get("requests", {}),
                limits=config.get("resources", {}).get("limits", {})
            )
        )
        
        # Pod template
        pod_template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(
                labels={
                    "app": "challenge",
                    "challenge-name": challenge_name,
                    "team-id": team_id,
                    "instance": pod_name
                }
            ),
            spec=client.V1PodSpec(containers=[container])
        )
        
        # Deployment spec
        deployment_spec = client.V1DeploymentSpec(
            replicas=1,
            selector=client.V1LabelSelector(
                match_labels={"instance": pod_name}
            ),
            template=pod_template
        )
        
        # Deployment
        deployment = client.V1Deployment(
            api_version="apps/v1",
            kind="Deployment",
            metadata=client.V1ObjectMeta(
                name=pod_name,
                namespace=namespace,
                labels={
                    "app": "challenge",
                    "challenge-name": challenge_name,
                    "team-id": team_id
                }
            ),
            spec=deployment_spec
        )
        
        return deployment
    
    def _create_service(self, service_name: str, pod_name: str, ports: List[int], public_ip: str, namespace: str):
        """Create Kubernetes service with LoadBalancer"""
        
        service_ports = [
            client.V1ServicePort(
                name=f"port-{port}",
                port=port,
                target_port=port,
                protocol="TCP"
            ) for port in ports
        ]
        
        service = client.V1Service(
            api_version="v1",
            kind="Service",
            metadata=client.V1ObjectMeta(
                name=service_name,
                namespace=namespace,
                labels={
                    "app": "challenge",
                    "instance": pod_name
                },
                annotations={
                    "metallb.universe.tf/address-pool": "pacstar-pool"
                }
            ),
            spec=client.V1ServiceSpec(
                type="LoadBalancer",
                selector={"instance": pod_name},
                ports=service_ports
            )
        )
        
        return service
    
    async def _wait_for_deployment_ready(self, namespace: str, deployment_name: str, timeout: int = 300):
        """Wait for deployment to be ready"""
        start_time = datetime.utcnow()
        
        while (datetime.utcnow() - start_time).seconds < timeout:
            try:
                deployment = self.apps_v1.read_namespaced_deployment(
                    name=deployment_name, namespace=namespace
                )
                
                if (deployment.status.ready_replicas == deployment.spec.replicas and
                    deployment.status.ready_replicas is not None):
                    logger.info(f"Deployment {deployment_name} is ready")
                    return
                    
            except ApiException:
                pass
            
            await asyncio.sleep(5)
        
        raise RuntimeError(f"Deployment {deployment_name} did not become ready within {timeout} seconds")
    
    async def _wait_for_loadbalancer_ip(self, namespace: str, service_name: str, timeout: int = 120):
        """Wait for LoadBalancer external IP to be assigned"""
        start_time = datetime.utcnow()
        
        while (datetime.utcnow() - start_time).seconds < timeout:
            try:
                service = self.core_v1.read_namespaced_service(
                    name=service_name, namespace=namespace
                )
                
                if service.status.load_balancer and service.status.load_balancer.ingress:
                    ingress = service.status.load_balancer.ingress[0]
                    external_ip = ingress.ip or ingress.hostname
                    if external_ip:
                        logger.info(f"Service {service_name} got external IP: {external_ip}")
                        return external_ip
                    
            except ApiException:
                pass
            
            await asyncio.sleep(5)
        
        logger.warning(f"LoadBalancer IP not assigned within {timeout}s, using pending")
        return "pending"
    
    async def _get_pod_internal_ip(self, namespace: str, pod_name: str) -> str:
        """Get internal IP of a pod"""
        try:
            # Find pod by label selector since deployment creates pods with random suffixes
            pods = self.core_v1.list_namespaced_pod(
                namespace=namespace,
                label_selector=f"instance={pod_name}"
            )
            
            if not pods.items:
                logger.error(f"No pods found with label instance={pod_name}")
                return "unknown"
            
            # Get the first running pod
            for pod in pods.items:
                if pod.status.phase == "Running":
                    return pod.status.pod_ip
            
            # If no running pod found, return the first pod's IP
            return pods.items[0].status.pod_ip
            
        except ApiException as e:
            logger.error(f"Failed to get pod IP for {pod_name}: {e}")
            return "unknown"
    
    async def stop_challenge_instance(self, namespace: str, pod_name: str, service_name: str, team_id: str):
        """Stop a challenge instance"""
        self._ensure_enabled()
        try:
            # Delete service
            try:
                self.core_v1.delete_namespaced_service(name=service_name, namespace=namespace)
                logger.info(f"Deleted service {service_name}")
            except ApiException as e:
                if e.status != 404:
                    logger.error(f"Failed to delete service {service_name}: {e}")
            
            # Delete deployment
            try:
                self.apps_v1.delete_namespaced_deployment(name=pod_name, namespace=namespace)
                logger.info(f"Deleted deployment {pod_name}")
            except ApiException as e:
                if e.status != 404:
                    logger.error(f"Failed to delete deployment {pod_name}: {e}")
            
            # Release IP
            self._release_ip_for_team(team_id)
            
        except Exception as e:
            logger.error(f"Failed to stop challenge instance: {e}")
            raise RuntimeError(f"Failed to stop challenge instance: {e}")
    
    async def get_challenge_status(self, namespace: str, pod_name: str) -> str:
        """Get status of a challenge instance"""
        self._ensure_enabled()
        try:
            pod = self.core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
            
            if pod.status.phase == "Running":
                return "running"
            elif pod.status.phase == "Pending":
                return "deploying"
            elif pod.status.phase == "Failed":
                return "failed"
            else:
                return "stopped"
                
        except ApiException as e:
            if e.status == 404:
                return "stopped"
            logger.error(f"Failed to get pod status: {e}")
            return "unknown"
    
    async def cleanup_challenge_namespace(self, namespace: str):
        """Clean up entire challenge namespace"""
        self._ensure_enabled()
        try:
            self.core_v1.delete_namespace(name=namespace)
            logger.info(f"Deleted namespace {namespace}")
        except ApiException as e:
            if e.status != 404:
                logger.error(f"Failed to delete namespace {namespace}: {e}")
                raise RuntimeError(f"Failed to cleanup namespace: {e}")


# Global instance
kubernetes_service = KubernetesService()
