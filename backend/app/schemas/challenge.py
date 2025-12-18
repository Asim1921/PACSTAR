from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class ChallengeStatus(str, Enum):
    PENDING = "pending"
    DEPLOYING = "deploying"
    RUNNING = "running"
    STOPPED = "stopped"
    FAILED = "failed"


class ChallengeType(str, Enum):
    JWT = "jwt"
    WEB = "web"
    CRYPTO = "crypto"
    REVERSE = "reverse"
    PWN = "pwn"


class ChallengeMode(str, Enum):
    STATIC = "static"
    DYNAMIC = "dynamic"
    MULTI_FLAG = "multi_flag"


class ArchitectureType(str, Enum):
    KUBERNETES = "kubernetes"
    OPENSTACK = "openstack"


class FlagMode(str, Enum):
    STATIC = "static"
    DYNAMIC = "dynamic"


class FlagServerConfig(BaseModel):
    """Configuration for the secure flag server."""
    url: Optional[str] = Field(None, description="Base URL of the flag server (HTTPS)")
    public_key: Optional[str] = Field(None, description="PEM-encoded server public key")
    server_token: Optional[str] = Field(None, description="Pre-shared token to authorize flag requests")
    encryption_scheme: str = Field(default="rsa-oaep", description="Encryption scheme for flags")
    ca_cert_path: Optional[str] = Field(None, description="Path to CA certificate for mutual TLS")


class BaydrakServiceConfig(BaseModel):
    """Baydrak service configuration surfaced to master admins for dynamic flags."""
    endpoint: Optional[str] = Field(None, description="Baydrak API endpoint")
    api_key: Optional[str] = Field(None, description="API key or token")
    project: Optional[str] = Field(None, description="Project or tenant identifier")
    namespace: Optional[str] = Field(None, description="Namespace (for Kubernetes)")
    cluster: Optional[str] = Field(None, description="Cluster or region")
    extras: Dict[str, Any] = Field(default_factory=dict, description="Additional baydrak_service metadata")


class FlagItem(BaseModel):
    """Represents a single flag entry for multi-flag challenges."""
    name: str = Field(..., description="Identifier for the flag")
    mode: FlagMode = Field(default=FlagMode.STATIC, description="Static or dynamic flag")
    value: Optional[str] = Field(None, description="Static flag value (if mode=static)")
    flag_server: Optional[FlagServerConfig] = Field(None, description="Flag server config (if mode=dynamic)")
    baydrak_service: Optional[BaydrakServiceConfig] = Field(None, description="Baydrak configuration for this flag (dynamic)")
    architecture: ArchitectureType = Field(default=ArchitectureType.KUBERNETES, description="Deployment architecture for this flag")


class ChallengeConfig(BaseModel):
    """Configuration for a challenge instance"""
    challenge_type: ChallengeType
    image: Optional[str] = Field(None, description="Docker image for the challenge (containerized only)")
    ports: Optional[List[int]] = Field(None, description="Ports to expose (containerized only)")
    environment_vars: Dict[str, Any] = Field(default_factory=dict, description="Environment variables")
    resources: Dict[str, Any] = Field(default_factory=dict, description="Resource limits and requests")
    health_check_path: Optional[str] = Field(None, description="Health check endpoint")
    flag_format: str = Field(default="crypto-TRI{flag_placeholder}", description="Flag format for the challenge")
    # For static challenges
    file_path: Optional[str] = Field(None, description="Path to uploaded file")
    file_name: Optional[str] = Field(None, description="Original filename")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    download_url: Optional[str] = Field(None, description="Download URL for the file")
    # For OpenStack challenges
    heat_template: Optional[str] = Field(None, description="Heat template content for OpenStack challenges")
    heat_template_parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Default parameters for Heat template")
    # New challenge model fields
    mode: ChallengeMode = Field(default=ChallengeMode.STATIC, description="Static, dynamic, or multi-flag challenge")
    architecture: ArchitectureType = Field(default=ArchitectureType.KUBERNETES, description="Deployment architecture")
    flag_server: Optional[FlagServerConfig] = Field(None, description="Flag server configuration for dynamic challenges")
    baydrak_service: Optional[BaydrakServiceConfig] = Field(None, description="Global Baydrak configuration when dynamic flags are enabled")
    flags: List[FlagItem] = Field(default_factory=list, description="List of flags (used when mode=multi_flag)")


class ChallengeBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, description="Challenge name")
    description: str = Field(..., min_length=10, max_length=500, description="Challenge description")
    config: ChallengeConfig
    zone: str = Field(default="zone1", min_length=2, max_length=50, description="Zone where this challenge is available (e.g., zone1, zone2, zone3)")
    # Scoring
    flag: Optional[str] = Field(None, description="Exact flag string teams must submit to solve the challenge (single-flag mode)")
    flags: Optional[List[FlagItem]] = Field(
        default=None,
        description="Multi-flag definitions; used when config.mode=multi_flag"
    )
    points: int = Field(default=100, ge=1, description="Points awarded for solving this challenge")
    total_teams: int = Field(..., ge=1, le=100, description="Number of teams to deploy for")
    is_active: bool = Field(default=True, description="Whether the challenge is active")
    allowed_teams: Optional[List[str]] = Field(
        default=None, 
        description="List of team IDs/codes that can see this challenge. If None or empty, all teams can see it."
    )
    challenge_category: str = Field(default="containerized", description="Challenge category: containerized, static, or openstack (legacy; derived from architecture)")


class ChallengeCreate(ChallengeBase):
    pass


class ChallengeUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=10, max_length=500)
    total_teams: Optional[int] = Field(None, ge=1, le=100)
    is_active: Optional[bool] = None
    config: Optional[ChallengeConfig] = None
    flag: Optional[str] = Field(None, description="Single flag value (static or dynamic)")
    flags: Optional[List[FlagItem]] = Field(
        default=None,
        description="Multi-flag definitions; used when config.mode=multi_flag"
    )
    allowed_teams: Optional[List[str]] = Field(
        None, 
        description="List of team IDs/codes that can see this challenge. If None or empty, all teams can see it."
    )


class ChallengeInstance(BaseModel):
    """Individual challenge instance for a team"""
    team_id: str = Field(..., description="Team identifier")
    instance_id: str = Field(..., description="Unique instance identifier")
    public_ip: str = Field(..., description="Public IP address assigned to this instance")
    internal_ip: str = Field(..., description="Internal cluster IP")
    status: ChallengeStatus
    created_at: datetime
    pod_name: Optional[str] = Field(None, description="Kubernetes pod name (containerized only)")
    service_name: Optional[str] = Field(None, description="Kubernetes service name (containerized only)")
    namespace: Optional[str] = Field(None, description="Kubernetes namespace (containerized only)")
    # For OpenStack challenges
    stack_id: Optional[str] = Field(None, description="Heat stack ID (OpenStack only)")
    stack_name: Optional[str] = Field(None, description="Heat stack name (OpenStack only)")
    server_id: Optional[str] = Field(None, description="OpenStack server ID (OpenStack only)")
    network_id: Optional[str] = Field(None, description="OpenStack network ID (OpenStack only)")
    vnc_console_url: Optional[str] = Field(None, description="VNC console URL for OpenStack VM (OpenStack only)")
    auto_delete_at: Optional[datetime] = Field(None, description="When to auto-delete the instance (OpenStack only)")
    last_reset_by: Optional[str] = Field(None, description="Username who last reset this instance")
    last_reset_at: Optional[datetime] = Field(None, description="When the instance was last reset")


class ChallengeResponse(ChallengeBase):
    id: str = Field(..., description="Challenge ID")
    status: ChallengeStatus
    instances: List[ChallengeInstance] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    created_by: str = Field(..., description="User who created the challenge")


class ChallengeListResponse(BaseModel):
    challenges: List[ChallengeResponse]
    total: int


class ChallengeDeployRequest(BaseModel):
    """Request to deploy a challenge"""
    challenge_id: Optional[str] = Field(default=None, description="Challenge ID (optional, can be inferred from URL)")
    force_redeploy: bool = Field(default=False, description="Force redeploy even if already running")
    team_id: Optional[str] = Field(default=None, description="Optional: Deploy for specific team. If not provided (Master only), deploys for all teams")


class ChallengeStopRequest(BaseModel):
    """Request to stop a challenge"""
    challenge_id: str
    remove_instances: bool = Field(default=False, description="Remove all instances")


class TeamAccessInfo(BaseModel):
    """Information for team access to their challenge instance"""
    team_id: str
    challenge_name: str
    public_ip: str
    ports: List[int]
    status: ChallengeStatus
    access_url: str = Field(..., description="Full access URL for the team")


class ChallengeStats(BaseModel):
    """Statistics for a challenge"""
    total_instances: int
    running_instances: int
    failed_instances: int
    total_teams: int
    ip_allocation: Dict[str, str] = Field(..., description="Team ID to IP mapping")


class FlagSubmitRequest(BaseModel):
    flag: str = Field(..., min_length=3, max_length=200, description="Submitted flag")


class ChallengeResetRequest(BaseModel):
    """Request to reset a challenge instance"""
    reset_type: str = Field(default="redeploy", description="Reset type: 'restart' (restart VM) or 'redeploy' (redeploy using Heat template)")


class ScoreEntry(BaseModel):
    team_id: str
    team_name: Optional[str] = None
    points: int
    solves: int


class ScoreboardResponse(BaseModel):
    scoreboard: List[ScoreEntry]
