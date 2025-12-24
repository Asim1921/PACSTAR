"""
Service for interacting with OpenStack (snapshots, instances, networks, deployments)
"""
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import motor.motor_asyncio
from openstack import connection
from openstack import exceptions as os_exceptions

from app.core.config import settings
from app.services.team_service import team_service

logger = logging.getLogger(__name__)


class OpenStackService:
    """
    High-level helper around openstacksdk used by API endpoints.
    Handles:
      - Listing snapshots, instances, networks
      - Providing environment summary
      - Deploying snapshots for PACSTAR teams
      - Storing deployment metadata in MongoDB
    """

    def __init__(self) -> None:
        self.enabled = bool(getattr(settings, "OPENSTACK_ENABLED", False))
        self._conn: Optional[connection.Connection] = None

        tls_args: Dict[str, Any] = {}
        mongodb_tls = getattr(settings, "MONGODB_TLS", False)
        if mongodb_tls:
            tls_args = {"tls": True}

        mongodb_uri = (
            settings.MONGODB_URI.split("?")[0]
            if not mongodb_tls
            else settings.MONGODB_URI
        )
        self._mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            mongodb_uri, **tls_args
        )
        self._db = self._mongo_client[settings.MONGODB_DB]
        self._deployments = self._db["openstack_deployments"]

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------
    def _ensure_enabled(self) -> None:
        if not self.enabled:
            raise RuntimeError("OpenStack integration is disabled")

    def _get_connection(self) -> connection.Connection:
        """
        Lazily create an OpenStack SDK connection.
        """
        self._ensure_enabled()

        if self._conn is not None:
            return self._conn

        required_fields = [
            "OPENSTACK_AUTH_URL",
            "OPENSTACK_USERNAME",
            "OPENSTACK_PASSWORD",
            "OPENSTACK_PROJECT_ID",
        ]
        missing = [
            field
            for field in required_fields
            if not getattr(settings, field, None)
        ]
        if missing:
            raise RuntimeError(
                f"Missing OpenStack configuration values: {', '.join(missing)}"
            )

        self._conn = connection.Connection(
            auth_url=settings.OPENSTACK_AUTH_URL,
            username=settings.OPENSTACK_USERNAME,
            password=settings.OPENSTACK_PASSWORD,
            project_id=settings.OPENSTACK_PROJECT_ID,
            project_name=settings.OPENSTACK_PROJECT_NAME,
            user_domain_name=settings.OPENSTACK_USER_DOMAIN_NAME,
            project_domain_id=settings.OPENSTACK_PROJECT_DOMAIN_ID,
            region_name=settings.OPENSTACK_REGION_NAME,
            interface=settings.OPENSTACK_INTERFACE,
            identity_api_version=settings.OPENSTACK_IDENTITY_API_VERSION,
            verify=settings.OPENSTACK_VERIFY_SSL,
        )
        logger.info("Initialized OpenStack connection to %s", settings.OPENSTACK_AUTH_URL)
        return self._conn

    async def _to_thread(self, func, *args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)

    def _snapshot_payload(self, image) -> Dict[str, Any]:
        props = getattr(image, "properties", {}) or {}
        size_gb = None
        if getattr(image, "size", None):
            size_gb = round(image.size / 1024 / 1024 / 1024, 2)
        return {
            "id": image.id,
            "name": image.name,
            "status": getattr(image, "status", None),
            "visibility": getattr(image, "visibility", None),
            "size_gb": size_gb,
            "min_disk": getattr(image, "min_disk", None),
            "created_at": getattr(image, "created_at", None),
            "updated_at": getattr(image, "updated_at", None),
            "metadata": props,
        }

    def _instance_payload(self, server) -> Dict[str, Any]:
        metadata = getattr(server, "metadata", {}) or {}
        addresses = getattr(server, "addresses", {}) or {}
        return {
            "id": server.id,
            "name": server.name,
            "status": server.status,
            "team_id": metadata.get("team_id"),
            "snapshot_id": metadata.get("snapshot_id"),
            "created_at": getattr(server, "created_at", None),
            "updated_at": getattr(server, "updated_at", None),
            "addresses": addresses,
            "flavor": getattr(server, "flavor", None),
            "metadata": metadata,
        }

    def _network_payload(self, network, availability=None) -> Dict[str, Any]:
        subnets = []
        for subnet_id in getattr(network, "subnet_ids", []) or []:
            subnets.append({"id": subnet_id})

        total_ips = getattr(availability, "total_ips", None) if availability else None
        used_ips = getattr(availability, "used_ips", None) if availability else None
        available_ips = None
        if total_ips is not None and used_ips is not None:
            available_ips = total_ips - used_ips

        return {
            "id": network.id,
            "name": network.name,
            "status": network.status,
            "is_router_external": getattr(network, "is_router_external", False),
            "subnets": subnets,
            "total_ips": total_ips,
            "used_ips": used_ips,
            "available_ips": available_ips,
        }

    def _generate_team_network_cidr(self, team_identifier: str) -> str:
        template = (
            settings.OPENSTACK_TEAM_NETWORK_CIDR_TEMPLATE
            or "10.250.{index}.0/24"
        )
        digest = hashlib.sha1(team_identifier.encode()).hexdigest()
        index = int(digest[:4], 16) % 200 + 10
        return template.format(index=index)

    def _ensure_team_network(
        self, conn: connection.Connection, team: Dict[str, Any]
    ) -> Dict[str, Any]:
        network_name = f"pacstar-team-{team['id']}"
        existing = None
        for net in conn.network.networks(name=network_name):
            existing = net
            break
        if existing:
            return existing

        cidr = self._generate_team_network_cidr(team["id"])
        net = conn.network.create_network(name=network_name)
        subnet = conn.network.create_subnet(
            network_id=net.id,
            ip_version=4,
            name=f"{network_name}-subnet",
            cidr=cidr,
            gateway_ip=str(ipaddress.ip_network(cidr)[1]),
            allocation_pools=[
                {
                    "start": str(ipaddress.ip_network(cidr)[10]),
                    "end": str(ipaddress.ip_network(cidr)[-2]),
                }
            ],
        )
        logger.info(
            "Created dedicated network %s (%s) for team %s",
            net.name,
            cidr,
            team["id"],
        )
        net.subnets = [subnet.id]
        return net

    def _stack_payload(self, stack) -> Dict[str, Any]:
        outputs = getattr(stack, "outputs", None)
        return {
            "stack_id": getattr(stack, "id", None) or getattr(stack, "stack_id", None),
            "stack_name": getattr(stack, "stack_name", None) or getattr(stack, "name"),
            "status": getattr(stack, "stack_status", None),
            "status_reason": getattr(stack, "stack_status_reason", None),
            "outputs": outputs,
        }

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------
    async def list_snapshots(self) -> List[Dict[str, Any]]:
        def _inner():
            conn = self._get_connection()
            snapshots = []
            for image in conn.image.images():
                image_type = (
                    getattr(image, "image_type", None)
                    or getattr(image, "properties", {}).get("image_type")
                )
                if image_type and image_type.lower() != "snapshot":
                    continue
                snapshots.append(self._snapshot_payload(image))
            return snapshots

        return await self._to_thread(_inner)

    async def list_instances(self, status: Optional[str] = "ACTIVE") -> List[Dict[str, Any]]:
        def _inner():
            conn = self._get_connection()
            instances = []
            for server in conn.compute.servers(details=True):
                if status and server.status != status:
                    continue
                instances.append(self._instance_payload(server))
            return instances

        return await self._to_thread(_inner)

    async def list_networks(self) -> List[Dict[str, Any]]:
        def _inner():
            conn = self._get_connection()
            networks = []
            for net in conn.network.networks():
                availability = None
                try:
                    availability = conn.network.get_network_ip_availability(net.id)
                except (os_exceptions.HttpException, AttributeError, ValueError) as e:
                    logger.warning(
                        "Unable to fetch IP availability for network %s: %s", net.id, e
                    )
                networks.append(self._network_payload(net, availability))
            return networks

        return await self._to_thread(_inner)

    async def summary(self) -> Dict[str, Any]:
        def _inner():
            conn = self._get_connection()
            limits = conn.compute.get_limits().absolute
            hypervisors = list(conn.compute.hypervisors())
            hypervisor_load = [
                {
                    "id": hv.id,
                    "name": hv.name,
                    "vcpus_used": getattr(hv, "vcpus_used", 0),
                    "vcpus": getattr(hv, "vcpus", 0),
                    "memory_mb_used": getattr(hv, "memory_mb_used", getattr(hv, "memory_mb", 0) - getattr(hv, "free_ram_mb", 0)),
                    "memory_mb": getattr(hv, "memory_mb", 0),
                    "running_vms": getattr(hv, "running_vms", 0),
                }
                for hv in hypervisors
            ]
            return {
                "total_instances": limits.get("maxTotalInstances"),
                "instances_in_use": limits.get("totalInstancesUsed"),
                "total_cores": limits.get("maxTotalCores"),
                "cores_in_use": limits.get("totalCoresUsed"),
                "total_ram_mb": limits.get("maxTotalRAMSize"),
                "ram_mb_in_use": limits.get("totalRAMUsed"),
                "hypervisors": hypervisor_load,
            }

        data = await self._to_thread(_inner)
        data["networks"] = await self.list_networks()
        return data

    async def list_teams(self) -> List[Dict[str, Any]]:
        teams = await team_service.list_teams(limit=1000)
        return [
            {
                "id": team.get("id") or team.get("_id"),
                "name": team.get("name"),
                "team_code": team.get("team_code"),
                "member_count": team.get("member_count"),
            }
            for team in teams
        ]

    async def build_deployment_plan(
        self, team_ids: List[str], instances_per_team: int
    ) -> Dict[str, Any]:
        networks = await self.list_networks()
        total_instances = max(1, instances_per_team) * max(1, len(team_ids))
        sorted_networks = sorted(
            networks, key=lambda n: n.get("available_ips") or 0, reverse=True
        )
        recommended = next(
            (net for net in sorted_networks if (net.get("available_ips") or 0) >= total_instances),
            None,
        )
        return {
            "total_instances": total_instances,
            "networks": sorted_networks,
            "recommended_network": recommended,
            "suggestion": (
                "Use dedicated network per team for improved isolation"
                if total_instances > 5
                else "Shared network is sufficient for this deployment size"
            ),
        }

    async def deploy_snapshot_for_teams(
        self,
        *,
        snapshot_id: str,
        flavor_id: Optional[str],
        team_ids: List[str],
        instances_per_team: int,
        network_strategy: str,
        shared_network_id: Optional[str],
        security_group_names: Optional[List[str]] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        self._ensure_enabled()
        flavor_to_use = flavor_id or settings.OPENSTACK_DEFAULT_FLAVOR_ID
        if not flavor_to_use:
            raise RuntimeError("Flavor ID is required to deploy instances")

        if not team_ids:
            raise RuntimeError("At least one team is required for deployment")

        teams_lookup = {team["id"]: team for team in await self.list_teams()}
        missing = [team_id for team_id in team_ids if team_id not in teams_lookup]
        if missing:
            raise RuntimeError(f"Teams not found: {', '.join(missing)}")

        def _deploy():
            conn = self._get_connection()
            created: List[Dict[str, Any]] = []
            snapshot = conn.compute.get_image(snapshot_id)
            snapshot_name = snapshot.name if snapshot else snapshot_id

            for team_id in team_ids:
                team = teams_lookup[team_id]
                if network_strategy == "shared":
                    network_id = shared_network_id or settings.OPENSTACK_DEFAULT_NETWORK_ID
                    if not network_id:
                        raise RuntimeError("Network ID is required for shared deployments")
                    resolved_network_id = network_id
                else:
                    team_net = self._ensure_team_network(conn, team)
                    resolved_network_id = team_net.id

                for index in range(instances_per_team):
                    server_name = f"{team['name']}-{snapshot_name}-{index+1}"
                    server = conn.compute.create_server(
                        name=server_name[:250],
                        image_id=snapshot_id,
                        flavor_id=flavor_to_use,
                        networks=[{"uuid": resolved_network_id}],
                        security_groups=[
                            {"name": sg_name} for sg_name in (security_group_names or [])
                        ] or None,
                        metadata={
                            "team_id": team_id,
                            "team_name": team["name"],
                            "snapshot_id": snapshot_id,
                            **(metadata or {}),
                        },
                    )
                    server = conn.compute.wait_for_server(server)
                    payload = self._instance_payload(server)
                    payload["network_id"] = resolved_network_id
                    created.append(payload)
                    logger.info(
                        "Launched server %s for team %s on network %s",
                        server.id,
                        team_id,
                        resolved_network_id,
                    )
            return created

        created_instances = await self._to_thread(_deploy)

        if created_instances:
            docs = []
            for instance in created_instances:
                docs.append(
                    {
                        "server_id": instance["id"],
                        "server_name": instance["name"],
                        "team_id": instance.get("team_id"),
                        "network_id": instance.get("network_id"),
                        "snapshot_id": instance.get("snapshot_id"),
                        "flavor": instance.get("flavor"),
                        "addresses": instance.get("addresses"),
                        "status": instance.get("status"),
                        "created_at": datetime.utcnow(),
                    }
                )
            await self._deployments.insert_many(docs)
        return created_instances

    async def deploy_heat_template(
        self,
        *,
        stack_name: str,
        template_body: Optional[str],
        template_url: Optional[str],
        parameters: Optional[Dict[str, Any]],
        timeout_minutes: Optional[int],
        rollback_on_failure: bool,
        reuse_if_exists: bool = True,
    ) -> Dict[str, Any]:
        self._ensure_enabled()

        def _create_stack():
            conn = self._get_connection()
            attrs: Dict[str, Any] = {
                "name": stack_name,
                "disable_rollback": not rollback_on_failure,
            }
            if template_body:
                attrs["template"] = template_body
            if template_url:
                attrs["template_url"] = template_url
            if parameters:
                attrs["parameters"] = parameters
            if timeout_minutes:
                attrs["timeout_mins"] = timeout_minutes

            try:
                stack = conn.orchestration.create_stack(**attrs)
                stack = conn.orchestration.get_stack(stack.id)
                logger.info("Triggered Heat stack %s (%s)", stack_name, stack.id)
                return self._stack_payload(stack)
            except os_exceptions.ConflictException:
                # Idempotency: stack already exists (common if previous attempt created it but our DB
                # didn't persist the instance record yet). Reuse existing stack instead of failing.
                if not reuse_if_exists:
                    raise
                existing = conn.orchestration.find_stack(stack_name, ignore_missing=True)
                if existing:
                    stack = conn.orchestration.get_stack(existing.id)
                    logger.warning(
                        "Heat stack %s already exists; reusing existing stack (%s)",
                        stack_name,
                        stack.id,
                    )
                    return self._stack_payload(stack)
                raise
            except os_exceptions.HttpException as e:
                # Some deployments raise generic HttpException for 409.
                if getattr(e, "status_code", None) == 409:
                    if not reuse_if_exists:
                        raise
                    existing = conn.orchestration.find_stack(stack_name, ignore_missing=True)
                    if existing:
                        stack = conn.orchestration.get_stack(existing.id)
                        logger.warning(
                            "Heat stack %s already exists (409); reusing existing stack (%s)",
                            stack_name,
                            stack.id,
                        )
                        return self._stack_payload(stack)
                raise

        return await self._to_thread(_create_stack)


openstack_service = OpenStackService()

