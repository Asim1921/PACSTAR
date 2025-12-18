from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.v1.endpoints.user import get_current_user
from app.db.models.user import UserInDB
from app.schemas.openstack import (
    OpenStackDeployRequest,
    OpenStackDeployResponse,
    OpenStackDeploymentPlanRequest,
    OpenStackDeploymentPlanResponse,
    OpenStackHeatDeployRequest,
    OpenStackHeatDeployResponse,
    OpenStackInstance,
    OpenStackNetwork,
    OpenStackSnapshot,
    OpenStackSummary,
    OpenStackTeamSummary,
)
from app.services.openstack_service import openstack_service

router = APIRouter(prefix="/openstack", tags=["openstack"])


def _require_master(current_user: UserInDB) -> None:
    if current_user.role != "Master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OpenStack APIs are restricted to Master role",
        )


def _ensure_enabled():
    if not openstack_service.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenStack integration is disabled. Configure OPENSTACK_* settings.",
        )


@router.get("/summary", response_model=OpenStackSummary)
async def get_openstack_summary(current_user: UserInDB = Depends(get_current_user)):
    _require_master(current_user)
    _ensure_enabled()
    try:
        return await openstack_service.summary()
    except Exception as exc:  # pragma: no cover - network errors
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch OpenStack summary: {exc}",
        ) from exc


@router.get("/snapshots", response_model=List[OpenStackSnapshot])
async def list_snapshots(current_user: UserInDB = Depends(get_current_user)):
    _require_master(current_user)
    _ensure_enabled()
    try:
        return await openstack_service.list_snapshots()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to list snapshots: {exc}",
        ) from exc


@router.get("/instances", response_model=List[OpenStackInstance])
async def list_instances(
    status_filter: Optional[str] = Query(
        "ACTIVE",
        description="Optional instance status filter (ACTIVE, SHUTOFF, etc.)",
    ),
    current_user: UserInDB = Depends(get_current_user),
):
    _require_master(current_user)
    _ensure_enabled()
    try:
        return await openstack_service.list_instances(status=status_filter)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to list instances: {exc}",
        ) from exc


@router.get("/networks", response_model=List[OpenStackNetwork])
async def list_networks(current_user: UserInDB = Depends(get_current_user)):
    _require_master(current_user)
    _ensure_enabled()
    try:
        return await openstack_service.list_networks()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to list networks: {exc}",
        ) from exc


@router.get("/teams", response_model=List[OpenStackTeamSummary])
async def list_openstack_teams(current_user: UserInDB = Depends(get_current_user)):
    _require_master(current_user)
    try:
        return await openstack_service.list_teams()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list teams: {exc}",
        ) from exc


@router.post(
    "/deployments/plan", response_model=OpenStackDeploymentPlanResponse
)
async def build_deployment_plan(
    request: OpenStackDeploymentPlanRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    _require_master(current_user)
    _ensure_enabled()
    if not request.team_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one team must be provided",
        )
    try:
        return await openstack_service.build_deployment_plan(
            request.team_ids, request.instances_per_team
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to build deployment plan: {exc}",
        ) from exc


@router.post("/deployments", response_model=OpenStackDeployResponse)
async def deploy_snapshot(
    request: OpenStackDeployRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    _require_master(current_user)
    _ensure_enabled()

    if not request.team_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one team is required",
        )

    try:
        created = await openstack_service.deploy_snapshot_for_teams(
            snapshot_id=request.snapshot_id,
            flavor_id=request.flavor_id,
            team_ids=request.team_ids,
            instances_per_team=request.instances_per_team,
            network_strategy=request.network_strategy,
            shared_network_id=request.network_id,
            security_group_names=request.security_group_names,
            metadata=request.metadata,
        )
        return OpenStackDeployResponse(created=created)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # pragma: no cover - external failures
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to deploy snapshot: {exc}",
        ) from exc


@router.post("/heat/deploy", response_model=OpenStackHeatDeployResponse)
async def deploy_heat_template(
    request: OpenStackHeatDeployRequest,
    current_user: UserInDB = Depends(get_current_user),
):
    _require_master(current_user)
    _ensure_enabled()

    try:
        return await openstack_service.deploy_heat_template(
            stack_name=request.stack_name,
            template_body=request.template_body,
            template_url=request.template_url,
            parameters=request.parameters,
            timeout_minutes=request.timeout_minutes,
            rollback_on_failure=request.rollback_on_failure,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to deploy Heat template: {exc}",
        ) from exc

