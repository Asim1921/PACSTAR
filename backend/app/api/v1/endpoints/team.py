"""
Team management endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.team import (
    TeamCreate, TeamUpdate, TeamResponse, TeamListResponse, JoinTeamRequest
)
from app.schemas.user import UserResponse
from app.services.team_service import team_service
from app.api.v1.endpoints.user import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create a new team"""
    from app.services.team_service import team_service
    
    # Check if user already has a team
    existing_team = await team_service.get_user_team(current_user.id)
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of a team. Leave your current team first."
        )
    
    team_dict = team_data.dict()
    created_team = await team_service.create_team(
        team_dict,
        current_user.id,
        current_user.username,
        current_user.email
    )
    
    # Update user's team info
    from app.services.auth_service import AuthService
    auth_service = AuthService()
    # Use team's zone if it exists, otherwise fallback to team-code based zone
    team_zone = created_team.get("zone") or f"team-{created_team['team_code']}"
    await auth_service.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {
            "$set": {
                "team_id": created_team["id"],
                "team_code": created_team["team_code"],
                "team_name": created_team.get("name"),
                "zone": team_zone
            }
        }
    )
    
    return TeamResponse(**created_team)


@router.post("/join", response_model=TeamResponse)
async def join_team(
    join_request: JoinTeamRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Join a team using team code"""
    from app.services.team_service import team_service
    
    # Check if user already has a team
    existing_team = await team_service.get_user_team(current_user.id)
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of a team. Leave your current team first."
        )
    
    team = await team_service.join_team(
        join_request.team_code,
        current_user.id,
        current_user.username,
        current_user.email
    )
    
    # Update user's team info
    from app.services.auth_service import AuthService
    auth_service = AuthService()
    # Use team's zone if it exists, otherwise fallback to team-code based zone
    team_zone = team.get("zone") or f"team-{team['team_code']}"
    await auth_service.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {
            "$set": {
                "team_id": team["id"],
                "team_code": team["team_code"],
                "team_name": team.get("name"),
                "zone": team_zone
            }
        }
    )
    
    return TeamResponse(**team)


@router.get("/my-team", response_model=TeamResponse)
async def get_my_team(
    current_user = Depends(get_current_user)
):
    """Get the current user's team"""
    from app.services.team_service import team_service
    
    # get_current_user returns UserInDB, need to convert id properly
    # Handle both UserInDB (from get_current_user) and UserResponse (from other endpoints)
    if hasattr(current_user, 'id'):
        # UserInDB has id as PyObjectId, need to convert to string
        if hasattr(current_user.id, '__str__'):
            user_id = str(current_user.id)
        else:
            user_id = current_user.id
    else:
        # Fallback: try to get from dict
        user_dict = current_user.dict() if hasattr(current_user, 'dict') else dict(current_user)
        user_id = str(user_dict.get('id', user_dict.get('_id', '')))
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    team = await team_service.get_user_team(user_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of any team"
        )
    
    return TeamResponse(**team)


@router.get("/", response_model=TeamListResponse)
async def list_teams(
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
    current_user: UserResponse = Depends(get_current_user)
):
    """List teams (Master can optionally include inactive teams)."""
    from app.services.team_service import team_service

    # Only Master can include inactive teams
    if include_inactive and current_user.role != "Master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can include inactive teams")

    zone_filter = None
    if current_user.role == "Admin":
        zone_filter = current_user.zone

    teams = await team_service.list_teams(skip=skip, limit=limit, include_inactive=include_inactive, zone=zone_filter)
    team_responses = [TeamResponse(**team) for team in teams]
    
    return TeamListResponse(teams=team_responses, total=len(team_responses))


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get team details by ID"""
    from app.services.team_service import team_service
    
    team = await team_service.get_team_by_id(team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    return TeamResponse(**team)


@router.patch("/{team_id}/active", response_model=TeamResponse)
async def set_team_active(
    team_id: str,
    is_active: bool,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Ban/Unban a team by toggling `is_active`.
    - Master: can ban/unban any team
    - Admin: can ban/unban teams in their own zone
    """
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Zone admins can only manage teams in their zone
    if current_user.role == "Admin":
        team = await team_service.get_team_by_id(team_id)
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        if team.get("zone") != current_user.zone:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins can only manage teams in their own zone")

    updated = await team_service.set_team_active(team_id, is_active)
    return TeamResponse(**updated)

