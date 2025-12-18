from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
import re
import logging

logger = logging.getLogger(__name__)

from app.schemas.challenge import (
    ChallengeCreate, ChallengeUpdate, ChallengeResponse, ChallengeListResponse,
    ChallengeDeployRequest, ChallengeStopRequest, TeamAccessInfo, ChallengeStats,
    FlagSubmitRequest, ScoreboardResponse, ScoreEntry, ChallengeResetRequest
)
from app.schemas.user import UserResponse
from app.services.challenge_service import challenge_service
from app.api.v1.endpoints.user import get_current_user

router = APIRouter(prefix="/challenges", tags=["challenges"])
security = HTTPBearer()


def _get_user_team_id(user: UserResponse) -> str:
    """
    Map user's team_code, team_id, zone or username to a team_id.
    Priority: team_id (from team) > team_code > zone > username pattern
    Examples: zone1 -> team-001, zone2 -> team-002, team1_* -> team-001
    """
    # First, check if user has a team_id (from team registration)
    user_dict = user.dict() if hasattr(user, 'dict') else dict(user)
    if user_dict.get('team_id'):
        # User is in a team - need to get team info to map to team_id
        # For now, use team-based zone or team_id directly
        # Team IDs in challenges use format team-001, team-002, etc.
        # We'll map team_id to challenge team format
        team_id = user_dict.get('team_id')
        # Extract number from team_id or use team_code-based mapping
        team_code = user_dict.get('team_code')
        if team_code:
            # Use team_code to generate a consistent team identifier
            # Use hex representation of hash for real teams (not restricted by total_teams)
            import hashlib
            hash_val = hashlib.md5(team_code.encode()).hexdigest()[:8]  # 8 hex chars
            return f"team-{hash_val}"  # e.g., team-690193a1
        # If no team_code, use team_id hash
        import hashlib
        hash_val = hashlib.md5(team_id.encode()).hexdigest()[:8]
        return f"team-{hash_val}"  # e.g., team-abc12345
    
    # Check if username matches team pattern (e.g., team1_*, team2_*)
    if user.username.startswith("team"):
        # Extract team number from username (e.g., "team1_xxx" -> "001")
        match = re.match(r"team(\d+)", user.username)
        if match:
            team_num = int(match.group(1))
            return f"team-{team_num:03d}"
    
    # Check if zone matches pattern (e.g., zone1 -> team-001)
    if user.zone.startswith("zone"):
        match = re.match(r"zone(\d+)", user.zone)
        if match:
            team_num = int(match.group(1))
            return f"team-{team_num:03d}"
    
    # Default: use zone as team identifier (with padding)
    # This is a fallback - ideally zones should follow zone1, zone2 pattern
    # If zone is just a number, convert it
    match = re.match(r"(\d+)", user.zone)
    if match:
        team_num = int(match.group(1))
        return f"team-{team_num:03d}"
    
    # Last resort: use zone string as-is (will need to match challenge team_id format)
    return user.zone


@router.post("/", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    challenge_data: ChallengeCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Create a new challenge.
    
    **Master role required.**
    """
    # Check if user has master role
    if current_user.role != "Master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master users can create challenges"
        )
    
    # Debug: Log what we received
    logger.info(f"API received challenge_data.challenge_category: {challenge_data.challenge_category}")
    logger.info(f"API received challenge_data dict: {challenge_data.model_dump()}")
    
    try:
        challenge = await challenge_service.create_challenge(
            challenge_data, current_user.id
        )
        return challenge
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create challenge: {str(e)}"
        )


@router.get("/", response_model=ChallengeListResponse)
async def list_challenges(
    skip: int = 0,
    limit: int = 100,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all challenges visible to the current user's team.
    
    **All authenticated users can view challenges.**
    - Master and Admin roles can see all challenges (active and inactive).
    - Regular users can only see active challenges that are:
      - Not restricted to specific teams (allowed_teams is None/empty), OR
      - Restricted to teams that include their team
    """
    try:
        challenges = await challenge_service.list_challenges(skip=skip, limit=limit)
        
        # Filter challenges based on user role and team restrictions
        if current_user.role not in ["Master", "Admin"]:
            # Regular users: filter by is_active and team restrictions
            user_team_id = _get_user_team_id(current_user)
            user_dict = current_user.dict() if hasattr(current_user, 'dict') else dict(current_user)
            user_team_code = user_dict.get('team_code')
            
            filtered_challenges = []
            for c in challenges:
                # Must be active
                if not c.is_active:
                    continue
                
                # Check team restrictions
                allowed_teams = getattr(c, 'allowed_teams', None)
                if allowed_teams and len(allowed_teams) > 0:
                    # Challenge is restricted - check if user's team is allowed
                    # Check both team_id (like team-001) and team_code
                    user_allowed = (user_team_id in allowed_teams) or (user_team_code and user_team_code in allowed_teams)
                    if not user_allowed:
                        continue  # Skip this challenge
                
                filtered_challenges.append(c)
            
            challenges = filtered_challenges
        
        return ChallengeListResponse(
            challenges=challenges,
            total=len(challenges)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list challenges: {str(e)}"
        )


@router.get("/scores", response_model=ScoreboardResponse)
async def get_scores(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get overall team scoreboard (Master/Admin sees all; Users also allowed to view)."""
    try:
        rows = await challenge_service.get_scoreboard()
        # Map to response entries
        entries: List[ScoreEntry] = [ScoreEntry(team_id=r["team_id"], points=r["points"], solves=r["solves"]) for r in rows]
        return ScoreboardResponse(scoreboard=entries)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get scores: {str(e)}")


@router.get("/{challenge_id}", response_model=ChallengeResponse)
async def get_challenge(
    challenge_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get a specific challenge by ID.
    
    **Master and Admin roles can see all challenges.**
    **Users can only see active challenges.**
    """
    try:
        challenge = await challenge_service.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found"
            )
        
        # Check access permissions
        if current_user.role not in ["Master", "Admin"] and not challenge.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to inactive challenge"
            )
        
        return challenge
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get challenge: {str(e)}"
        )


@router.put("/{challenge_id}", response_model=ChallengeResponse)
async def update_challenge(
    challenge_id: str,
    update_data: ChallengeUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update a challenge.
    
    **Master role required.**
    """
    # Check if user has master role
    if current_user.role != "Master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master users can update challenges"
        )
    
    try:
        challenge = await challenge_service.update_challenge(challenge_id, update_data)
        return challenge
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update challenge: {str(e)}"
        )


@router.delete("/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_challenge(
    challenge_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Delete a challenge and all its instances.
    
    **Master role required.**
    """
    # Check if user has master role
    if current_user.role != "Master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master users can delete challenges"
        )
    
    try:
        success = await challenge_service.delete_challenge(challenge_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete challenge: {str(e)}"
        )


@router.post("/{challenge_id}/deploy", response_model=ChallengeResponse)
async def deploy_challenge(
    challenge_id: str,
    deploy_request: ChallengeDeployRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Deploy a challenge to Kubernetes.
    
    - **Master role**: Can deploy for all teams (if team_id not provided) or specific team
    - **Regular users**: Can only deploy their own team instance (must provide team_id matching their team)
    """
    # If team_id is provided, validate access
    if deploy_request.team_id:
        # Map user to team_id (using zone or username pattern)
        user_team_id = _get_user_team_id(current_user)
        
        # Regular users can only deploy for themselves
        if current_user.role != "Master" and deploy_request.team_id != user_team_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You can only deploy challenges for your own team ({user_team_id})"
            )
        
        # Deploy for single team
        try:
            challenge = await challenge_service.deploy_challenge_for_team(
                challenge_id, deploy_request.team_id, deploy_request.force_redeploy
            )
            return challenge
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to deploy challenge: {str(e)}"
            )
    else:
        # No team_id provided - deploy for all teams (Master only)
        if current_user.role != "Master":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Master users can deploy challenges for all teams. Use /start endpoint to deploy for your team."
            )
        
        try:
            challenge = await challenge_service.deploy_challenge(
                challenge_id, deploy_request.force_redeploy
            )
            return challenge
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to deploy challenge: {str(e)}"
            )


@router.post("/{challenge_id}/stop", response_model=ChallengeResponse)
async def stop_challenge(
    challenge_id: str,
    stop_request: ChallengeStopRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Stop a challenge and optionally remove all instances.
    
    **Master role required.**
    """
    # Check if user has master role
    if current_user.role != "Master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master users can stop challenges"
        )
    
    try:
        challenge = await challenge_service.stop_challenge(
            challenge_id, stop_request.remove_instances
        )
        return challenge
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop challenge: {str(e)}"
        )


@router.get("/{challenge_id}/team/{team_id}/access", response_model=TeamAccessInfo)
async def get_team_access_info(
    challenge_id: str,
    team_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get access information for a specific team.
    
    **All authenticated users can access this endpoint.**
    """
    try:
        access_info = await challenge_service.get_team_access_info(challenge_id, team_id)
        if not access_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team access information not found"
            )
        
        return TeamAccessInfo(**access_info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get team access info: {str(e)}"
        )


@router.post("/{challenge_id}/start", response_model=ChallengeResponse)
async def start_challenge_instance(
    challenge_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Start/deploy a challenge instance for the current user's team.
    
    **All authenticated users can start challenges for their team.**
    Master users should use /deploy endpoint instead.
    """
    if current_user.role == "Master":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Master users should use /deploy endpoint instead"
        )
    
    # Get user's team_id
    team_id = _get_user_team_id(current_user)
    
    try:
        challenge = await challenge_service.deploy_challenge_for_team(
            challenge_id, team_id, force_redeploy=False
        )
        return challenge
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start challenge instance: {str(e)}"
        )


@router.post("/{challenge_id}/reset", response_model=ChallengeResponse)
async def reset_challenge_instance(
    challenge_id: str,
    reset_request: Optional[ChallengeResetRequest] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Reset/redeploy a challenge instance for the current user's team.
    
    For containerized/static: Deletes the existing instance and deploys a fresh one.
    For OpenStack: Supports two reset types:
    - 'restart': Restarts the existing VM
    - 'redeploy': Deletes and redeploys using Heat template
    
    **All authenticated users can reset their team's challenge.**
    """
    if current_user.role == "Master":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Master users should manage instances from admin panel"
        )
    
    # Get user's team_id
    team_id = _get_user_team_id(current_user)
    
    # Default reset type
    reset_type = "redeploy"
    if reset_request:
        reset_type = reset_request.reset_type
    
    if reset_type not in ["restart", "redeploy"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reset_type must be 'restart' or 'redeploy'"
        )
    
    try:
        challenge = await challenge_service.reset_challenge_for_team(
            challenge_id, team_id, reset_type=reset_type, reset_by_username=current_user.username
        )
        return challenge
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset challenge instance: {str(e)}"
        )


@router.get("/{challenge_id}/stats", response_model=ChallengeStats)
async def get_challenge_stats(
    challenge_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get statistics for a challenge.
    
    **Master and Admin roles can see all stats.**
    **Users can only see basic stats for active challenges.**
    """
    try:
        stats = await challenge_service.get_challenge_stats(challenge_id)
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found"
            )
        
        # Filter stats based on user role
        if current_user.role not in ["Master", "Admin"]:
            # Users can only see basic stats
            filtered_stats = {
                "total_instances": stats["total_instances"],
                "running_instances": stats["running_instances"],
                "failed_instances": stats["failed_instances"],
                "total_teams": stats["total_teams"],
                "ip_allocation": {}  # Hide IP allocation from regular users
            }
            return ChallengeStats(**filtered_stats)
        
        return ChallengeStats(**stats)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get challenge stats: {str(e)}"
        )


@router.post("/{challenge_id}/submit-flag")
async def submit_flag(
    challenge_id: str,
    submit: FlagSubmitRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Submit a flag for a challenge. Awards points if correct and not previously solved by the team.
    """
    # Determine team id of current user
    team_id = _get_user_team_id(current_user)
    try:
        result = await challenge_service.submit_flag(challenge_id, team_id, current_user.id, submit.flag)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to submit flag: {str(e)}")
