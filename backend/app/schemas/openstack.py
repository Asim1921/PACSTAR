from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, root_validator


class OpenStackSnapshot(BaseModel):
    id: str
    name: str
    status: Optional[str] = None
    visibility: Optional[str] = None
    size_gb: Optional[float] = Field(default=None, description="Approximate size in GB")
    min_disk: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class OpenStackInstance(BaseModel):
    id: str
    name: str
    status: Optional[str] = None
    team_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    addresses: Optional[Dict[str, Any]] = None
    flavor: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    network_id: Optional[str] = None


class OpenStackNetwork(BaseModel):
    id: str
    name: str
    status: Optional[str] = None
    is_router_external: bool = False
    subnets: List[Dict[str, Any]] = Field(default_factory=list)
    total_ips: Optional[int] = None
    used_ips: Optional[int] = None
    available_ips: Optional[int] = None


class OpenStackSummary(BaseModel):
    total_instances: Optional[int] = None
    instances_in_use: Optional[int] = None
    total_cores: Optional[int] = None
    cores_in_use: Optional[int] = None
    total_ram_mb: Optional[int] = None
    ram_mb_in_use: Optional[int] = None
    hypervisors: List[Dict[str, Any]] = Field(default_factory=list)
    networks: List[OpenStackNetwork] = Field(default_factory=list)


class OpenStackTeamSummary(BaseModel):
    id: str
    name: Optional[str] = None
    team_code: Optional[str] = None
    member_count: Optional[int] = None


class OpenStackDeploymentPlanRequest(BaseModel):
    team_ids: List[str]
    instances_per_team: int = Field(ge=1, default=1)


class OpenStackDeploymentPlanResponse(BaseModel):
    total_instances: int
    networks: List[OpenStackNetwork]
    recommended_network: Optional[OpenStackNetwork] = None
    suggestion: Optional[str] = None


class OpenStackDeployRequest(BaseModel):
    snapshot_id: str
    team_ids: List[str]
    instances_per_team: int = Field(ge=1, default=1)
    flavor_id: Optional[str] = None
    network_strategy: Literal["shared", "per_team"] = "shared"
    network_id: Optional[str] = Field(
        default=None,
        description="Required when using shared network strategy (unless default configured)",
    )
    security_group_names: Optional[List[str]] = None
    metadata: Optional[Dict[str, str]] = None


class OpenStackDeployResponse(BaseModel):
    created: List[OpenStackInstance]


class OpenStackHeatDeployRequest(BaseModel):
    stack_name: str = Field(..., min_length=3, description="Friendly stack name")
    template_body: Optional[str] = Field(
        default=None, description="HOT/YAML template body"
    )
    template_url: Optional[str] = Field(
        default=None, description="URL that hosts the HOT template"
    )
    parameters: Optional[Dict[str, Any]] = Field(
        default=None, description="Stack parameters map"
    )
    timeout_minutes: Optional[int] = Field(
        default=60,
        ge=1,
        le=720,
        description="Timeout before stack creation fails",
    )
    rollback_on_failure: bool = Field(
        default=True,
        description="Automatically rollback resources if deployment fails",
    )

    @root_validator(skip_on_failure=True)
    def ensure_template_source(cls, values):
        body = values.get("template_body")
        url = values.get("template_url")
        if not body and not url:
            raise ValueError("Provide either template_body or template_url")
        return values


class OpenStackHeatDeployResponse(BaseModel):
    stack_id: str
    stack_name: str
    status: Optional[str] = None
    status_reason: Optional[str] = None
    outputs: Optional[List[Dict[str, Any]]] = None

