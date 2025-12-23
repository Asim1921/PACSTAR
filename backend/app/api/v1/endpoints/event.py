"""
Event API Endpoints for CTF Events and Cyber Exercises

This module provides FastAPI endpoints for:
- Event CRUD operations with zone-based RBAC
- Event approval workflow
- Challenge orchestration
- Flag submissions
- Live statistics and dashboard
- Scoreboard

Port: Uses the same FastAPI app (port 8000 by default)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.security import HTTPBearer
import logging
from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId

from app.schemas.event import (
    EventCreate, EventUpdate, EventResponse, EventListResponse, EventStatus,
    EventType, EventApprovalRequest, EventPauseRequest, FlagSubmission,
    SubmissionResponse, EventLiveStats, EventScoreboardResponse, UserStats,
    TeamStats, HintUnlockRequest, HintUnlockResponse, EventRegistration,
    EventRegistrationResponse, AvailableChallengeResponse, ChallengeVisibility,
    ChallengeVisibilityUpdate, EventSummary
)
from app.schemas.user import UserResponse, PasswordResetRequest
from app.services.event_service import event_service
from app.api.v1.endpoints.user import get_current_user
from app.core.security import hash_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])
security = HTTPBearer()


def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# =============================================================================
# Event CRUD Endpoints
# =============================================================================

@router.post(
    "/",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event",
    description="""
    Create a new CTF event or Cyber Exercise.
    
    **Zone Admin**: Can create events only in their zone. Event requires Master Admin approval.
    **Master Admin**: Can create events in any zone. No approval required.
    
    Events include:
    - CTF (Capture The Flag)
    - Cyber Exercise
    
    Participation types:
    - User-based: Individual scoring
    - Team-based: Team scoring
    """
)
async def create_event(
    event_data: EventCreate,
    request: Request,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create a new event"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master or Zone Admin can create events"
        )
    
    try:
        event = await event_service.create_event(
            event_data=event_data,
            created_by_id=str(current_user.id),
            created_by_username=current_user.username,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create event: {str(e)}"
        )


@router.get(
    "/",
    response_model=EventListResponse,
    summary="List events",
    description="""
    List all events visible to the current user.
    
    **Master Admin**: Can view all events in all zones.
    **Zone Admin**: Can view events in their zone.
    **User**: Can view public events or events in their zone.
    """
)
async def list_events(
    status_filter: Optional[EventStatus] = Query(None, description="Filter by status"),
    event_type: Optional[EventType] = Query(None, description="Filter by event type"),
    skip: int = Query(0, ge=0, description="Number of events to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum events to return"),
    current_user: UserResponse = Depends(get_current_user)
):
    """List events with filtering"""
    try:
        # PACSTAR policy: individual (non-team) users must join a team before they can see events.
        if current_user.role == "User" and not getattr(current_user, "team_id", None):
            return EventListResponse(events=[], total=0)

        events = await event_service.list_events(
            user_role=current_user.role,
            user_zone=current_user.zone,
            status_filter=status_filter,
            event_type_filter=event_type,
            skip=skip,
            limit=limit
        )
        return EventListResponse(events=events, total=len(events))
    except Exception as e:
        logger.error(f"Failed to list events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list events: {str(e)}"
        )


@router.get(
    "/available-challenges",
    response_model=List[AvailableChallengeResponse],
    summary="Get available challenges for event creation",
    description="Get all active challenges that can be added to events. Filtered by zone if zone parameter provided."
)
async def get_available_challenges(
    zone: Optional[str] = Query(None, description="Filter challenges by zone (required when creating event)"),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get available challenges for event creation, filtered by zone"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master or Admin can view available challenges"
        )
    
    try:
        challenges = await event_service.get_available_challenges(zone=zone, user_zone=current_user.zone, user_role=current_user.role)
        return [AvailableChallengeResponse(**c) for c in challenges]
    except Exception as e:
        logger.error(f"Failed to get available challenges: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get available challenges: {str(e)}"
        )


@router.get(
    "/pending-approvals",
    response_model=List[EventResponse],
    summary="Get events pending approval",
    description="Get all events pending Master Admin approval. **Master Admin only.**"
)
async def get_pending_approvals(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get events pending approval (Master only)"""
    if current_user.role != "Master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master Admin can view pending approvals"
        )
    
    try:
        events = await event_service.get_pending_approvals()
        return events
    except Exception as e:
        logger.error(f"Failed to get pending approvals: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pending approvals: {str(e)}"
        )


# =============================================================================
# Notification Endpoints (Must come before /{event_id} routes)
# =============================================================================

@router.get(
    "/notifications",
    summary="Get user notifications",
    description="Get all notifications for the current user."
)
async def get_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get notifications for the current user"""
    try:
        from app.services.event_service import event_service
        
        user_id = str(current_user.id)
        query = {"user_id": user_id}
        
        if unread_only:
            query["read"] = False
        
        notifications = await event_service.db["notifications"].find(query).sort("created_at", -1).limit(50).to_list(length=50)
        
        return {
            "notifications": [
                {
                    "id": str(n["_id"]),
                    "type": n.get("type", "event_started"),
                    "event_id": n.get("event_id"),
                    "event_name": n.get("event_name"),
                    "title": n.get("title") or n.get("event_name"),
                    "message": n.get("message"),
                    "action": n.get("action", "join_event"),
                    "ui_type": n.get("ui_type", "toast"),
                    "play_sound": bool(n.get("play_sound", False)),
                    "source": n.get("source"),
                    "broadcast_id": n.get("broadcast_id"),
                    "created_at": n.get("created_at").isoformat() if n.get("created_at") else None,
                    "read": n.get("read", False)
                }
                for n in notifications
            ],
            "unread_count": await event_service.db["notifications"].count_documents({"user_id": user_id, "read": False})
        }
    except Exception as e:
        logger.error(f"Failed to get notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notifications: {str(e)}"
        )


@router.post(
    "/notifications/{notification_id}/read",
    summary="Mark notification as read",
    description="Mark a notification as read."
)
async def mark_notification_read(
    notification_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Mark a notification as read"""
    try:
        from app.services.event_service import event_service
        from bson import ObjectId
        
        result = await event_service.db["notifications"].update_one(
            {"_id": ObjectId(notification_id), "user_id": str(current_user.id)},
            {"$set": {"read": True}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        return {"success": True, "message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark notification as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark notification as read: {str(e)}"
        )


class BroadcastNotificationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120, description="Notification title")
    message: str = Field(..., min_length=1, max_length=2000, description="Notification content")
    ui_type: str = Field(default="toast", description="toast | alert | background")
    play_sound: bool = Field(default=False, description="Whether clients should play a sound")
    zone: Optional[str] = Field(default=None, description="Optional zone filter. Omit for all zones.")
    include_admins: bool = Field(default=True, description="Include Admin users (non-Master)")


@router.post(
    "/notifications/broadcast",
    summary="Broadcast a notification (Master only)",
    description="Broadcast a notification to all users/teams (optionally scoped by zone). Creates per-user notification rows."
)
async def broadcast_notification(
    body: BroadcastNotificationRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    if current_user.role != "Master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can broadcast notifications")

    ui_type = (body.ui_type or "toast").lower().strip()
    if ui_type not in ["toast", "alert", "background"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ui_type (toast|alert|background)")

    try:
        from app.services.event_service import event_service

        now = datetime.utcnow()
        zone = (body.zone or "").strip() or None

        # Create broadcast meta record (used for master feed + de-duplication)
        broadcast_doc = {
            "title": body.title.strip(),
            "message": body.message.strip(),
            "ui_type": ui_type,
            "play_sound": bool(body.play_sound),
            "zone": zone,
            "created_at": now,
            "created_by_user_id": str(current_user.id),
            "created_by_username": current_user.username,
        }
        res = await event_service.db["notification_broadcasts"].insert_one(broadcast_doc)
        broadcast_id = str(res.inserted_id)

        # Determine recipients
        user_query: dict = {"is_active": True, "role": {"$ne": "Master"}}
        if not body.include_admins:
            user_query["role"] = "User"
        if zone:
            user_query["zone"] = zone

        users = await event_service.db["users"].find(
            user_query,
            {"username": 1, "zone": 1, "team_id": 1, "team_code": 1, "team_name": 1}
        ).to_list(length=200000)

        notifications = []
        for u in users:
            uid = str(u.get("_id"))
            notifications.append({
                "type": "broadcast",
                "title": body.title.strip(),
                "message": body.message.strip(),
                "ui_type": ui_type,
                "play_sound": bool(body.play_sound),
                "source": "master_broadcast",
                "broadcast_id": broadcast_id,
                "zone": u.get("zone"),
                "user_id": uid,
                "username": u.get("username"),
                "team_id": str(u.get("team_id")) if u.get("team_id") else None,
                "team_code": u.get("team_code"),
                "team_name": u.get("team_name"),
                "action": "none",
                "created_at": now,
                "read": False,
            })

        if notifications:
            # Batch insert for performance
            await event_service.db["notifications"].insert_many(notifications)

        await event_service.db["notification_broadcasts"].update_one(
            {"_id": res.inserted_id},
            {"$set": {"targets_count": len(notifications)}}
        )

        return {
            "success": True,
            "broadcast_id": broadcast_id,
            "targets_count": len(notifications),
            "created_at": now.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to broadcast notification: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to broadcast notification: {str(e)}")


@router.get(
    "/notifications/broadcasts",
    summary="Broadcast notification feed (Master only)",
    description="Get recent Master broadcast notifications (deduplicated feed)."
)
async def list_broadcast_notifications(
    zone: Optional[str] = Query(None, description="Optional zone filter"),
    current_user: UserResponse = Depends(get_current_user)
):
    if current_user.role != "Master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can view broadcast feed")
    try:
        from app.services.event_service import event_service
        q: dict = {}
        if zone:
            q["zone"] = zone
        rows = await event_service.db["notification_broadcasts"].find(q).sort("created_at", -1).limit(50).to_list(length=50)
        return {
            "broadcasts": [
                {
                    "id": str(r.get("_id")),
                    "title": r.get("title"),
                    "message": r.get("message"),
                    "ui_type": r.get("ui_type", "toast"),
                    "play_sound": bool(r.get("play_sound", False)),
                    "zone": r.get("zone"),
                    "targets_count": r.get("targets_count", 0),
                    "created_by_username": r.get("created_by_username"),
                    "created_at": r.get("created_at").isoformat() if r.get("created_at") else None,
                }
                for r in rows
            ]
        }
    except Exception as e:
        logger.error(f"Failed to list broadcast notifications: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list broadcast notifications: {str(e)}")


# =============================================================================
# Event CRUD Endpoints (Parameterized routes come after specific ones)
# =============================================================================

@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get event details",
    description="Get detailed information about a specific event."
)
async def get_event(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get event by ID"""
    try:
        # PACSTAR policy: individual (non-team) users must join a team before they can view event details.
        if current_user.role == "User" and not getattr(current_user, "team_id", None):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join a team to access events")

        event = await event_service.get_event(
            event_id=event_id,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get event: {str(e)}"
        )


@router.put(
    "/{event_id}",
    response_model=EventResponse,
    summary="Update event",
    description="""
    Update an existing event.
    
    **Zone Admin**: Can update draft/rejected events in their zone.
    **Master Admin**: Can update any event.
    """
)
async def update_event(
    event_id: str,
    update_data: EventUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update an event"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master or Admin can update events"
        )
    
    try:
        event = await event_service.update_event(
            event_id=event_id,
            update_data=update_data,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        # Check if it's a validation error or "not found" error
        error_msg = str(e).lower()
        if "not found" in error_msg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        else:
            # Validation errors should be 400 Bad Request
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update event: {str(e)}"
        )


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete event",
    description="""
    Delete an event and all related data.
    
    **Zone Admin**: Can delete draft/rejected events in their zone.
    **Master Admin**: Can delete any event.
    """
)
async def delete_event(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete an event"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master or Admin can delete events"
        )
    
    try:
        success = await event_service.delete_event(
            event_id=event_id,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete event: {str(e)}"
        )


# =============================================================================
# Approval Workflow Endpoints
# =============================================================================

@router.post(
    "/{event_id}/submit-for-approval",
    response_model=EventResponse,
    summary="Submit event for approval",
    description="Submit a draft event for Master Admin approval."
)
async def submit_for_approval(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Submit event for Master Admin approval"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master or Admin can submit events for approval"
        )
    
    try:
        event = await event_service.submit_for_approval(
            event_id=event_id,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to submit event for approval: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit for approval: {str(e)}"
        )


@router.post(
    "/{event_id}/approve",
    response_model=EventResponse,
    summary="Approve or reject event",
    description="Approve or reject an event pending approval. **Master Admin only.**"
)
async def approve_event(
    event_id: str,
    approval_request: EventApprovalRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Approve or reject an event (Master only)"""
    if current_user.role != "Master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master Admin can approve events"
        )
    
    try:
        event = await event_service.approve_event(
            event_id=event_id,
            approval_request=approval_request,
            approver_id=str(current_user.id),
            approver_username=current_user.username
        )
        return event
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to approve event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve event: {str(e)}"
        )


# =============================================================================
# Event Control Endpoints
# =============================================================================

@router.post(
    "/{event_id}/start",
    response_model=EventResponse,
    summary="Start event",
    description="Start an approved/scheduled event."
)
async def start_event(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Start an event"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master or Admin can start events"
        )
    
    try:
        event = await event_service.start_event(
            event_id=event_id,
            user_role=current_user.role
        )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to start event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start event: {str(e)}"
        )


@router.post(
    "/{event_id}/pause",
    response_model=EventResponse,
    summary="Pause or resume event",
    description="Pause a running event or resume a paused event."
)
async def pause_event(
    event_id: str,
    pause_request: EventPauseRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Pause or resume an event"""
    # Allow Master/Admin OR event-scoped event admin
    effective_role = current_user.role
    if current_user.role not in ["Master", "Admin"]:
        is_event_admin = await event_service.is_event_admin(event_id, str(current_user.id))
        if not is_event_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Master/Admin or assigned Event Admin can pause/resume events"
            )
        # Treat event admin as Master for service-layer checks (service only restricts zone admins)
        effective_role = "Master"
    
    try:
        event = await event_service.pause_event(
            event_id=event_id,
            pause_request=pause_request,
            user_role=effective_role,
            user_zone=current_user.zone
        )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to pause/resume event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pause/resume event: {str(e)}"
        )


@router.post(
    "/{event_id}/end",
    response_model=EventResponse,
    summary="End event",
    description="End a running or paused event."
)
async def end_event(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """End an event"""
    # Allow Master/Admin OR event-scoped event admin
    effective_role = current_user.role
    if current_user.role not in ["Master", "Admin"]:
        is_event_admin = await event_service.is_event_admin(event_id, str(current_user.id))
        if not is_event_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Master/Admin or assigned Event Admin can end events"
            )
        effective_role = "Master"
    
    try:
        event = await event_service.end_event(
            event_id=event_id,
            user_role=effective_role,
            user_zone=current_user.zone
        )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to end event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to end event: {str(e)}"
        )


# =============================================================================
# Challenge Visibility Endpoints
# =============================================================================

@router.put(
    "/{event_id}/challenges/{challenge_id}/visibility",
    response_model=EventResponse,
    summary="Update challenge visibility",
    description="Show or hide a challenge within an event."
)
async def update_challenge_visibility(
    event_id: str,
    challenge_id: str,
    visibility_update: ChallengeVisibilityUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update challenge visibility in an event"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Master or Admin can update challenge visibility"
        )
    
    try:
        event = await event_service.update_challenge_visibility(
            event_id=event_id,
            challenge_id=challenge_id,
            visibility=visibility_update.visibility,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return event
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update challenge visibility: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update visibility: {str(e)}"
        )


# =============================================================================
# Registration Endpoints
# =============================================================================

@router.get(
    "/{event_id}/admin-candidates",
    summary="List event admin candidates",
    description="Master can choose an Event Admin from registered participants."
)
async def list_event_admin_candidates(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    if current_user.role != "Master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can assign Event Admin")
    try:
        return {"candidates": await event_service.list_event_admin_candidates(event_id)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to list event admin candidates: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed: {str(e)}")


@router.put(
    "/{event_id}/admin",
    summary="Assign event admin",
    description="Assign (or clear) a single Event Admin for this event. Master only."
)
async def set_event_admin(
    event_id: str,
    user_id: Optional[str] = Query(None, description="User ID to assign. Omit/empty to clear."),
    current_user: UserResponse = Depends(get_current_user)
):
    if current_user.role != "Master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can assign Event Admin")
    try:
        return await event_service.set_event_admin(event_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to set event admin: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed: {str(e)}")


@router.get(
    "/{event_id}/teams",
    summary="List teams in event",
    description="List teams participating in this event and whether they are banned. Master/Admin/Event Admin."
)
async def list_event_teams(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        if current_user.role not in ["Master", "Admin"]:
            is_event_admin = await event_service.is_event_admin(event_id, str(current_user.id))
            if not is_event_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        teams = await event_service.list_event_teams(event_id)
        return {"teams": teams}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to list event teams: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed: {str(e)}")


@router.post(
    "/{event_id}/teams/{team_id}/ban",
    summary="Ban team for event",
    description="Ban a team (team_id) within this event. Master/Admin/Event Admin."
)
async def ban_team_for_event(
    event_id: str,
    team_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        if current_user.role not in ["Master", "Admin"]:
            is_event_admin = await event_service.is_event_admin(event_id, str(current_user.id))
            if not is_event_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        return await event_service.ban_team_for_event(event_id, team_id)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to ban team: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed: {str(e)}")


@router.post(
    "/{event_id}/teams/{team_id}/reset-password",
    summary="Reset team users' passwords for this event",
    description="Reset passwords for all **User** accounts in a specific team participating in this event's zone. Master/Admin/Event Admin."
)
async def reset_team_password_for_event(
    event_id: str,
    team_id: str,
    body: PasswordResetRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        # AuthZ: Master/Admin OR assigned Event Admin
        if current_user.role not in ["Master", "Admin"]:
            is_event_admin = await event_service.is_event_admin(event_id, str(current_user.id))
            if not is_event_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

        # Load event and enforce zone boundary (Admin + Event Admin are event-scoped)
        if not ObjectId.is_valid(event_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event ID")
        event = await event_service.events.find_one({"_id": ObjectId(event_id)}, {"zone": 1})
        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        event_zone = event.get("zone")
        if current_user.role == "Admin" and current_user.zone != event_zone:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin can only manage events in their zone")

        # Verify team is actually participating in this event
        team_participant = await event_service.event_participants.find_one({"event_id": event_id, "team_id": team_id})
        if not team_participant and ObjectId.is_valid(team_id):
            team_participant = await event_service.event_participants.find_one({"event_id": event_id, "team_id": ObjectId(team_id)})
        if not team_participant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team is not registered for this event")

        # Update all user accounts in that team for this event zone (Users only; never Admin/Master)
        hashed = hash_password(body.new_password)
        team_oid = ObjectId(team_id) if ObjectId.is_valid(team_id) else None
        team_match = [{"team_id": team_id}]
        if team_oid:
            team_match.append({"team_id": team_oid})

        result = await event_service.users.update_many(
            {
                "zone": event_zone,
                "role": "User",
                "$or": team_match,
            },
            {"$set": {"hashed_password": hashed}}
        )

        return {
            "success": True,
            "event_id": event_id,
            "team_id": team_id,
            "updated_users": result.modified_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset team passwords for event {event_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed: {str(e)}")


@router.post(
    "/{event_id}/users/{user_id}/reset-password",
    summary="Reset a user's password for this event",
    description="Reset a **User** account password for a user participating in this event/zone. Master/Admin/Event Admin."
)
async def reset_user_password_for_event(
    event_id: str,
    user_id: str,
    body: PasswordResetRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        if current_user.role not in ["Master", "Admin"]:
            is_event_admin = await event_service.is_event_admin(event_id, str(current_user.id))
            if not is_event_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

        if not ObjectId.is_valid(event_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event ID")
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

        event = await event_service.events.find_one({"_id": ObjectId(event_id)}, {"zone": 1})
        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        event_zone = event.get("zone")
        if current_user.role == "Admin" and current_user.zone != event_zone:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin can only manage events in their zone")

        target = await event_service.users.find_one({"_id": ObjectId(user_id)}, {"role": 1, "zone": 1, "team_id": 1})
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if target.get("role") != "User":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only User accounts can be reset by event admin")
        if target.get("zone") != event_zone:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not in this event's zone")

        # Verify participation: either the user registered directly OR their team is registered.
        participant = await event_service.event_participants.find_one({"event_id": event_id, "user_id": user_id})
        if not participant:
            team_id_val = target.get("team_id")
            if team_id_val:
                participant = await event_service.event_participants.find_one({"event_id": event_id, "team_id": team_id_val})
                if not participant and isinstance(team_id_val, str) and ObjectId.is_valid(team_id_val):
                    participant = await event_service.event_participants.find_one({"event_id": event_id, "team_id": ObjectId(team_id_val)})
        if not participant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User/team is not registered for this event")

        hashed = hash_password(body.new_password)
        await event_service.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"hashed_password": hashed}})
        return {"success": True, "event_id": event_id, "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset user password for event {event_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed: {str(e)}")


@router.delete(
    "/{event_id}/teams/{team_id}/ban",
    summary="Unban team for event",
    description="Unban a team within this event. Master/Admin/Event Admin."
)
async def unban_team_for_event(
    event_id: str,
    team_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        if current_user.role not in ["Master", "Admin"]:
            is_event_admin = await event_service.is_event_admin(event_id, str(current_user.id))
            if not is_event_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        return await event_service.unban_team_for_event(event_id, team_id)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to unban team: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed: {str(e)}")


@router.post(
    "/{event_id}/register",
    response_model=EventRegistrationResponse,
    summary="Register for event",
    description="Register the current user/team for an event. Users must register to see and solve challenges."
)
async def register_for_event(
    event_id: str,
    request: Request,
    current_user: UserResponse = Depends(get_current_user)
):
    """Register for an event"""
    try:
        # PACSTAR policy: users must be part of a team to register for events.
        if current_user.role == "User" and not getattr(current_user, "team_id", None):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join a team to register for events")

        # PACSTAR policy: users must be verified to register for events.
        if current_user.role == "User" and not getattr(current_user, "is_verified", True):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not verified. Contact your Admin/Master.")

        # Get team info if available
        team_id = getattr(current_user, 'team_id', None)
        team_name = None
        if team_id:
            # Get team name from team service
            from app.services.team_service import team_service
            team = await team_service.get_team_by_id(team_id)
            team_name = team.get("name") if team else None
        
        result = await event_service.register_participant(
            event_id=event_id,
            user_id=str(current_user.id),
            username=current_user.username,
            user_zone=current_user.zone,
            team_id=team_id,
            team_name=team_name
        )
        return EventRegistrationResponse(**result)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to register for event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register: {str(e)}"
        )


@router.get(
    "/{event_id}/registration-status",
    summary="Check registration status",
    description="Check if the current user/team is registered for an event."
)
async def check_registration_status(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Check if user is registered for an event"""
    try:
        # PACSTAR policy: users must be part of a team to access event registration info.
        if current_user.role == "User" and not getattr(current_user, "team_id", None):
            return {"is_registered": False, "event_id": event_id}

        user_dict = current_user.dict() if hasattr(current_user, 'dict') else dict(current_user)
        team_id = user_dict.get('team_id')
        
        is_registered = await event_service.is_user_registered(
            event_id=event_id,
            user_id=str(current_user.id),
            team_id=team_id
        )
        
        return {"is_registered": is_registered, "event_id": event_id}
    except Exception as e:
        logger.error(f"Failed to check registration status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check registration status: {str(e)}"
        )


# =============================================================================
# Flag Submission Endpoints
# =============================================================================

@router.post(
    "/{event_id}/challenges/{challenge_id}/submit",
    response_model=SubmissionResponse,
    summary="Submit flag",
    description="Submit a flag for a challenge in an event."
)
async def submit_flag(
    event_id: str,
    challenge_id: str,
    submission: FlagSubmission,
    request: Request,
    current_user: UserResponse = Depends(get_current_user)
):
    """Submit a flag for a challenge"""
    try:
        # Get team info if available
        team_id = getattr(current_user, 'team_id', None)
        team_name = None
        if team_id:
            from app.services.team_service import team_service
            team = await team_service.get_team_by_id(team_id)
            team_name = team.get("name") if team else None
        
        result = await event_service.submit_flag(
            event_id=event_id,
            challenge_id=challenge_id,
            user_id=str(current_user.id),
            username=current_user.username,
            user_zone=current_user.zone,
            submitted_flag=submission.flag,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
            team_id=team_id,
            team_name=team_name
        )
        return result
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Defensive: in some environments PermissionError can get wrapped/normalized unexpectedly.
        # If this is effectively a permission issue, return 403 instead of 500.
        if isinstance(e, PermissionError) or "banned for this event" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        logger.error(f"Failed to submit flag: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit flag: {str(e)}"
        )


# =============================================================================
# Hint Endpoints
# =============================================================================

@router.post(
    "/{event_id}/challenges/{challenge_id}/hints/unlock",
    response_model=HintUnlockResponse,
    summary="Unlock hint",
    description="Unlock a hint for a challenge. May cost points."
)
async def unlock_hint(
    event_id: str,
    challenge_id: str,
    hint_request: HintUnlockRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Unlock a hint"""
    try:
        team_id = getattr(current_user, 'team_id', None)
        result = await event_service.unlock_hint(
            event_id=event_id,
            challenge_id=challenge_id,
            hint_id=hint_request.hint_id,
            user_id=str(current_user.id),
            team_id=team_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to unlock hint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unlock hint: {str(e)}"
        )


# =============================================================================
# Statistics and Dashboard Endpoints
# =============================================================================

@router.get(
    "/{event_id}/stats",
    response_model=EventLiveStats,
    summary="Get live statistics",
    description="""
    Get live statistics for event dashboard.
    
    Includes:
    - Total participants, users, teams
    - Total submissions (correct/incorrect)
    - Most/least solved challenges
    - Top performers
    - Category proficiency distribution
    - IP address mappings
    - Submissions timeline
    """
)
async def get_live_stats(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get live event statistics"""
    try:
        stats = await event_service.get_live_stats(
            event_id=event_id,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return stats
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get live stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )


@router.get(
    "/{event_id}/scoreboard",
    response_model=EventScoreboardResponse,
    summary="Get scoreboard",
    description="Get event scoreboard with rankings."
)
async def get_scoreboard(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get event scoreboard"""
    try:
        scoreboard = await event_service.get_scoreboard(
            event_id=event_id,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return scoreboard
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get scoreboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scoreboard: {str(e)}"
        )


@router.get(
    "/{event_id}/users/{user_id}/stats",
    response_model=UserStats,
    summary="Get user statistics",
    description="Get detailed statistics for a specific user in an event."
)
async def get_user_stats(
    event_id: str,
    user_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get user statistics in an event"""
    try:
        stats = await event_service.get_user_stats(
            event_id=event_id,
            user_id=user_id,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return stats
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get user stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user statistics: {str(e)}"
        )


@router.get(
    "/{event_id}/teams/{team_id}/stats",
    response_model=TeamStats,
    summary="Get team statistics",
    description="Get detailed statistics for a specific team in an event."
)
async def get_team_stats(
    event_id: str,
    team_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get team statistics in an event"""
    try:
        stats = await event_service.get_team_stats(
            event_id=event_id,
            team_id=team_id,
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return stats
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get team stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get team statistics: {str(e)}"
        )


@router.get(
    "/{event_id}/my-stats",
    response_model=UserStats,
    summary="Get my statistics",
    description="Get the current user's statistics in an event."
)
async def get_my_stats(
    event_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get current user's statistics in an event"""
    try:
        stats = await event_service.get_user_stats(
            event_id=event_id,
            user_id=str(current_user.id),
            user_role=current_user.role,
            user_zone=current_user.zone
        )
        return stats
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get my stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )

