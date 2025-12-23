"""
Event Service for managing CTF Events and Cyber Exercises

This service handles:
- Event CRUD operations with zone-based RBAC
- Event approval workflow (Zone Admin creates, Master Admin approves)
- Challenge orchestration via Kubernetes and OpenStack
- Scoring and statistics
- Live dashboard data
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import motor.motor_asyncio

from app.core.config import settings
from app.schemas.event import (
    EventCreate, EventUpdate, EventResponse, EventStatus, EventType,
    EventParticipationType, EventChallengeConfig, EventChallengeResponse,
    HintResponse, ChallengeVisibility, EventLiveStats, UserStats, TeamStats,
    ChallengeStatsDetail, ScoreboardEntry, EventScoreboardResponse,
    SubmissionResponse, HintUnlockResponse, EventApprovalRequest,
    EventPauseRequest, EventSummary
)

logger = logging.getLogger(__name__)


class EventService:
    """Service for managing events with zone-based RBAC"""
    
    def __init__(self):
        # Build TLS args if enabled
        tls_args = {}
        mongodb_tls = getattr(settings, "MONGODB_TLS", False)
        if isinstance(mongodb_tls, str):
            mongodb_tls = mongodb_tls.lower() in ('true', '1', 'yes', 'on')
        
        if mongodb_tls:
            tls_args = {"tls": True}
        
        # Use full URI including authSource parameter
        mongodb_uri = settings.MONGODB_URI
        
        self.client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_uri, **tls_args)
        self.db = self.client[settings.MONGODB_DB]
        
        # Collections
        self.events = self.db["events"]
        self.event_submissions = self.db["event_submissions"]
        self.event_participants = self.db["event_participants"]
        self.event_scores = self.db["event_scores"]
        self.challenges = self.db["challenges"]
        self.users = self.db["users"]
        self.teams = self.db["teams"]
    
    # =========================================================================
    # Event CRUD Operations
    # =========================================================================
    
    async def create_event(
        self,
        event_data: EventCreate,
        created_by_id: str,
        created_by_username: str,
        user_role: str,
        user_zone: str
    ) -> EventResponse:
        """
        Create a new event.
        
        - Zone Admins can only create events in their zone
        - Master can create events in any zone
        - Events created by Zone Admins require Master approval
        """
        # Zone restriction for Admins
        if user_role == "Admin" and event_data.zone != user_zone:
            raise PermissionError(f"Admin can only create events in their zone ({user_zone})")
        
        # Validate challenges exist and are active
        challenge_docs = []
        for challenge_config in event_data.challenges:
            challenge = await self.challenges.find_one({
                "_id": ObjectId(challenge_config.challenge_id),
                "is_active": True
            })
            if not challenge:
                raise ValueError(f"Challenge {challenge_config.challenge_id} not found or inactive")
            challenge_docs.append(challenge)
        
        # Build event document
        now = datetime.utcnow()
        
        # Determine initial status based on creator role
        # - Admin: requires approval
        # - Master: no approval; auto-schedule or auto-run based on start_time
        if user_role == "Admin":
            initial_status = EventStatus.PENDING_APPROVAL
        elif user_role == "Master":
            now_utc = datetime.utcnow()
            try:
                start_dt = event_data.start_time
                # Normalize to naive UTC for comparison
                if isinstance(start_dt, datetime) and start_dt.tzinfo is not None:
                    start_dt_cmp = start_dt.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    start_dt_cmp = start_dt
                initial_status = EventStatus.RUNNING if start_dt_cmp <= now_utc else EventStatus.SCHEDULED
            except Exception:
                # Safe fallback
                initial_status = EventStatus.DRAFT
        else:
            initial_status = EventStatus.DRAFT
        
        # Build challenges with hints
        event_challenges = []
        for i, config in enumerate(event_data.challenges):
            challenge = challenge_docs[i]
            hints = []
            for j, hint in enumerate(config.hints):
                hints.append({
                    "id": str(ObjectId()),
                    "content": hint.content,
                    "hint_type": hint.hint_type.value,
                    "cost": hint.cost,
                    "order": hint.order,
                    "unlocked_by": [],
                    "created_at": now
                })
            
            event_challenges.append({
                "challenge_id": config.challenge_id,
                "challenge_name": challenge["name"],
                "challenge_category": challenge.get("challenge_category", "containerized"),
                "skill_category": challenge.get("skill_category") or challenge.get("config", {}).get("challenge_type") or "web",
                "description": challenge["description"],
                "visibility": config.visibility.value,
                "points": config.points_override or challenge.get("points", 100),
                "order": config.order,
                "unlock_after": config.unlock_after,
                "hints": hints,
                "max_attempts": config.max_attempts,
                "solve_count": 0,
                "first_blood": None,
                "first_blood_time": None
            })
        
        event_doc = {
            "name": event_data.name,
            "description": event_data.description,
            "event_type": event_data.event_type.value,
            "participation_type": event_data.participation_type.value,
            "zone": event_data.zone,
            "start_time": event_data.start_time,
            "end_time": event_data.end_time,
            "max_participants": event_data.max_participants,
            "is_public": event_data.is_public,
            "status": initial_status.value,
            "challenges": event_challenges,
            "created_by": created_by_id,
            "created_by_username": created_by_username,
            "approved_by": None,
            "approval_comments": None,
            "approved_at": None,
            "paused_at": None,
            "pause_reason": None,
            "participant_count": 0,
            # Event-scoped admin + bans
            "event_admin_user_id": None,
            "event_admin_username": None,
            "banned_team_ids": [],
            "created_at": now,
            "updated_at": now
        }
        
        result = await self.events.insert_one(event_doc)
        event_doc["_id"] = result.inserted_id
        
        logger.info(f"Created event '{event_data.name}' in zone {event_data.zone} by {created_by_username}")
        
        return self._event_to_response(event_doc)
    
    async def get_event(
        self,
        event_id: str,
        user_role: str,
        user_zone: str
    ) -> Optional[EventResponse]:
        """
        Get event by ID with zone-based access control.
        
        - Master can view all events
        - Zone Admins can view events in their zone
        - Users can view events in their zone (if event is public or in same zone)
        """
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            return None
        
        # Access control
        if user_role != "Master":
            if event["zone"] != user_zone and not event.get("is_public", False):
                raise PermissionError("Access denied to this event")
        
        return self._event_to_response(event)
    
    async def list_events(
        self,
        user_role: str,
        user_zone: str,
        status_filter: Optional[EventStatus] = None,
        event_type_filter: Optional[EventType] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[EventResponse]:
        """
        List events with zone-based filtering.
        
        - Master can view all events in all zones
        - Zone Admins can view events in their zone
        - Users can view public events or events in their zone
        """
        query = {}
        
        # Zone filtering
        if user_role == "Master":
            # Master sees all
            pass
        elif user_role == "Admin":
            # Admin sees their zone
            query["zone"] = user_zone
        else:
            # Users see their zone or public events
            query["$or"] = [
                {"zone": user_zone},
                {"is_public": True}
            ]
        
        # Status filter
        if status_filter:
            query["status"] = status_filter.value
        
        # Event type filter
        if event_type_filter:
            query["event_type"] = event_type_filter.value
        
        cursor = self.events.find(query).sort("created_at", -1).skip(skip).limit(limit)
        events = await cursor.to_list(length=limit)
        
        return [self._event_to_response(e) for e in events]
    
    async def update_event(
        self,
        event_id: str,
        update_data: EventUpdate,
        user_role: str,
        user_zone: str
    ) -> EventResponse:
        """
        Update an event.
        
        - Zone Admins can update events in their zone (if not yet approved)
        - Master can update any event
        """
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Permission check
        if user_role == "Admin":
            if event["zone"] != user_zone:
                raise PermissionError("Admin can only update events in their zone")
            if event["status"] not in [EventStatus.DRAFT.value, EventStatus.REJECTED.value]:
                raise PermissionError("Cannot update event after approval submission")
        
        # Build update document
        update_doc = {"updated_at": datetime.utcnow()}
        
        if update_data.name is not None:
            update_doc["name"] = update_data.name
        if update_data.description is not None:
            update_doc["description"] = update_data.description
        if update_data.zone is not None:
            # Zone restriction for Admins
            if user_role == "Admin" and update_data.zone != user_zone:
                raise PermissionError(f"Admin can only update events to their zone ({user_zone})")
            update_doc["zone"] = update_data.zone
        
        # Handle datetime updates with validation
        # Validate start_time and end_time relationship before updating
        new_start_time = update_data.start_time if update_data.start_time is not None else event.get("start_time")
        new_end_time = update_data.end_time if update_data.end_time is not None else event.get("end_time")
        
        # Validate end_time is after start_time
        if new_start_time and new_end_time:
            # Normalize both to UTC for comparison
            from datetime import timezone
            start_dt = new_start_time
            end_dt = new_end_time
            
            # Convert to UTC if timezone-aware, or assume UTC if naive
            if isinstance(start_dt, datetime):
                if start_dt.tzinfo is None:
                    # Assume naive datetime is UTC
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
                else:
                    # Convert to UTC
                    start_dt = start_dt.astimezone(timezone.utc)
            else:
                logger.warning(f"Unexpected start_time type: {type(start_dt)}")
                start_dt = None
                
            if isinstance(end_dt, datetime):
                if end_dt.tzinfo is None:
                    # Assume naive datetime is UTC
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                else:
                    # Convert to UTC
                    end_dt = end_dt.astimezone(timezone.utc)
            else:
                logger.warning(f"Unexpected end_time type: {type(end_dt)}")
                end_dt = None
            
            # Compare in UTC
            if start_dt and end_dt and end_dt <= start_dt:
                raise ValueError("end_time must be after start_time")
        
        # Now update the document
        if update_data.start_time is not None:
            update_doc["start_time"] = update_data.start_time
            
        if update_data.end_time is not None:
            update_doc["end_time"] = update_data.end_time
        if update_data.max_participants is not None:
            update_doc["max_participants"] = update_data.max_participants
        if update_data.is_public is not None:
            update_doc["is_public"] = update_data.is_public
        
        # Handle challenges update
        if update_data.challenges is not None:
            challenge_docs = []
            for config in update_data.challenges:
                challenge = await self.challenges.find_one({
                    "_id": ObjectId(config.challenge_id),
                    "is_active": True
                })
                if not challenge:
                    raise ValueError(f"Challenge {config.challenge_id} not found or inactive")
                challenge_docs.append(challenge)
            
            event_challenges = []
            now = datetime.utcnow()
            for i, config in enumerate(update_data.challenges):
                challenge = challenge_docs[i]
                hints = []
                for hint in config.hints:
                    hints.append({
                        "id": str(ObjectId()),
                        "content": hint.content,
                        "hint_type": hint.hint_type.value,
                        "cost": hint.cost,
                        "order": hint.order,
                        "unlocked_by": [],
                        "created_at": now
                    })
                
                event_challenges.append({
                    "challenge_id": config.challenge_id,
                    "challenge_name": challenge["name"],
                    "challenge_category": challenge.get("challenge_category", "containerized"),
                    "skill_category": challenge.get("skill_category") or challenge.get("config", {}).get("challenge_type") or "web",
                    "description": challenge["description"],
                    "visibility": config.visibility.value,
                    "points": config.points_override or challenge.get("points", 100),
                    "order": config.order,
                    "unlock_after": config.unlock_after,
                    "hints": hints,
                    "max_attempts": config.max_attempts,
                    "solve_count": 0,
                    "first_blood": None,
                    "first_blood_time": None
                })
            
            update_doc["challenges"] = event_challenges
        
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$set": update_doc}
        )
        
        updated_event = await self.events.find_one({"_id": ObjectId(event_id)})
        return self._event_to_response(updated_event)
    
    async def delete_event(
        self,
        event_id: str,
        user_role: str,
        user_zone: str
    ) -> bool:
        """
        Delete an event.
        
        - Zone Admins can delete their draft events
        - Master can delete any event
        """
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            return False
        
        # Permission check
        if user_role == "Admin":
            if event["zone"] != user_zone:
                raise PermissionError("Admin can only delete events in their zone")
            if event["status"] not in [EventStatus.DRAFT.value, EventStatus.REJECTED.value]:
                raise PermissionError("Cannot delete event after approval")
        
        # Delete related data
        await self.event_submissions.delete_many({"event_id": event_id})
        await self.event_participants.delete_many({"event_id": event_id})
        await self.event_scores.delete_many({"event_id": event_id})
        
        # Delete event
        result = await self.events.delete_one({"_id": ObjectId(event_id)})
        
        logger.info(f"Deleted event {event_id}")
        return result.deleted_count > 0
    
    # =========================================================================
    # Approval Workflow
    # =========================================================================
    
    async def submit_for_approval(
        self,
        event_id: str,
        user_role: str,
        user_zone: str
    ) -> EventResponse:
        """Submit event for Master Admin approval"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        if user_role == "Admin" and event["zone"] != user_zone:
            raise PermissionError("Admin can only submit events in their zone")
        
        if event["status"] not in [EventStatus.DRAFT.value, EventStatus.REJECTED.value]:
            raise ValueError("Only draft or rejected events can be submitted for approval")
        
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": {
                    "status": EventStatus.PENDING_APPROVAL.value,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        updated_event = await self.events.find_one({"_id": ObjectId(event_id)})
        logger.info(f"Event {event_id} submitted for approval")
        return self._event_to_response(updated_event)
    
    async def approve_event(
        self,
        event_id: str,
        approval_request: EventApprovalRequest,
        approver_id: str,
        approver_username: str
    ) -> EventResponse:
        """
        Approve or reject an event (Master Admin only).
        """
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        if event["status"] != EventStatus.PENDING_APPROVAL.value:
            raise ValueError("Event is not pending approval")
        
        # Get current time in Pakistan timezone (UTC+5) for comparison
        pakistan_tz = timezone(timedelta(hours=5))
        now_pakistan = datetime.now(pakistan_tz)
        now_utc = datetime.utcnow()
        
        new_status = EventStatus.APPROVED if approval_request.approved else EventStatus.REJECTED
        
        # If approved and start time is in future, set to scheduled
        # If approved and start time is in past or now, auto-start the event
        if approval_request.approved:
            start_time = event.get("start_time")
            
            # Handle timezone-aware or naive datetime
            if isinstance(start_time, datetime):
                # Event start_time is stored in UTC in database
                if start_time.tzinfo:
                    start_time_utc = start_time.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    # Assume naive datetime is UTC
                    start_time_utc = start_time
                
                # Convert UTC start_time to Pakistan timezone for comparison
                start_time_pakistan = start_time_utc.replace(tzinfo=timezone.utc).astimezone(pakistan_tz)
                
                # Compare in Pakistan timezone
                if start_time_pakistan > now_pakistan:
                    new_status = EventStatus.SCHEDULED
                    logger.info(f"Event {event_id} approved and scheduled for {start_time_pakistan.strftime('%Y-%m-%d %H:%M:%S PKT')}")
                else:
                    # Start time has passed, auto-start the event
                    new_status = EventStatus.RUNNING
                    logger.info(f"Event {event_id} approved and auto-started (Pakistan time: {start_time_pakistan.strftime('%Y-%m-%d %H:%M:%S PKT')} <= {now_pakistan.strftime('%Y-%m-%d %H:%M:%S PKT')})")
                    # Notify teams in the zone (will be done after status update)
            else:
                # Invalid start_time, default to scheduled
                logger.warning(f"Event {event_id} has invalid start_time type: {type(start_time)}")
                new_status = EventStatus.SCHEDULED
        
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": {
                    "status": new_status.value,
                    "approved_by": approver_username,
                    "approval_comments": approval_request.comments,
                    "approved_at": now_utc,
                    "updated_at": now_utc
                }
            }
        )
        
        updated_event = await self.events.find_one({"_id": ObjectId(event_id)})
        action = "approved" if approval_request.approved else "rejected"
        logger.info(f"Event {event_id} {action} by {approver_username}")
        
        # If event was auto-started, notify teams
        if approval_request.approved and new_status == EventStatus.RUNNING:
            await self._notify_teams_event_started(updated_event)
        
        return self._event_to_response(updated_event)
    
    async def get_pending_approvals(self) -> List[EventResponse]:
        """Get all events pending approval (Master Admin only)"""
        cursor = self.events.find({"status": EventStatus.PENDING_APPROVAL.value})
        events = await cursor.to_list(length=1000)
        return [self._event_to_response(e) for e in events]
    
    # =========================================================================
    # Event Control (Start, Stop, Pause)
    # =========================================================================
    
    async def start_event(self, event_id: str, user_role: str) -> EventResponse:
        """Start an approved/scheduled event"""
        if user_role not in ["Master", "Admin"]:
            raise PermissionError("Only Master or Admin can start events")
        
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        if event["status"] not in [EventStatus.APPROVED.value, EventStatus.SCHEDULED.value]:
            raise ValueError("Only approved or scheduled events can be started")
        
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": {
                    "status": EventStatus.RUNNING.value,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        updated_event = await self.events.find_one({"_id": ObjectId(event_id)})
        logger.info(f"Event {event_id} started")
        
        # Notify teams in the zone
        await self._notify_teams_event_started(updated_event)
        
        return self._event_to_response(updated_event)
    
    async def pause_event(
        self,
        event_id: str,
        pause_request: EventPauseRequest,
        user_role: str,
        user_zone: str
    ) -> EventResponse:
        """Pause or resume a running event"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Permission check
        if user_role == "Admin" and event["zone"] != user_zone:
            raise PermissionError("Admin can only control events in their zone")
        
        if pause_request.paused:
            if event["status"] != EventStatus.RUNNING.value:
                raise ValueError("Only running events can be paused")
            new_status = EventStatus.PAUSED
            paused_at = datetime.utcnow()
        else:
            if event["status"] != EventStatus.PAUSED.value:
                raise ValueError("Only paused events can be resumed")
            new_status = EventStatus.RUNNING
            paused_at = None
        
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": {
                    "status": new_status.value,
                    "paused_at": paused_at,
                    "pause_reason": pause_request.reason,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        updated_event = await self.events.find_one({"_id": ObjectId(event_id)})
        action = "paused" if pause_request.paused else "resumed"
        logger.info(f"Event {event_id} {action}")
        return self._event_to_response(updated_event)
    
    async def end_event(
        self,
        event_id: str,
        user_role: str,
        user_zone: str
    ) -> EventResponse:
        """End a running or paused event"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Permission check
        if user_role == "Admin" and event["zone"] != user_zone:
            raise PermissionError("Admin can only control events in their zone")
        
        if event["status"] not in [EventStatus.RUNNING.value, EventStatus.PAUSED.value]:
            raise ValueError("Only running or paused events can be ended")
        
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": {
                    "status": EventStatus.COMPLETED.value,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        updated_event = await self.events.find_one({"_id": ObjectId(event_id)})
        logger.info(f"Event {event_id} ended")

        # Cleanup deployed challenge instances so old IPs don't persist into future events.
        try:
            await self.cleanup_event_challenge_instances(event_id)
        except Exception as e:
            logger.error(f"Failed to cleanup challenge instances for event {event_id}: {e}", exc_info=True)

        return self._event_to_response(updated_event)

    # =========================================================================
    # Event-scoped Admin + Team Bans
    # =========================================================================

    async def is_event_admin(self, event_id: str, user_id: str) -> bool:
        event = await self.events.find_one({"_id": ObjectId(event_id)}, {"event_admin_user_id": 1})
        if not event:
            return False
        return str(event.get("event_admin_user_id") or "") == str(user_id)

    async def set_event_admin(self, event_id: str, user_id: Optional[str]) -> Dict[str, Any]:
        """Assign (or clear) an event admin for a specific event."""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")

        admin_username = None
        admin_user_id = None
        if user_id:
            user_doc = await self.users.find_one({"_id": ObjectId(user_id)}, {"username": 1})
            if not user_doc:
                raise ValueError("User not found")
            admin_username = user_doc.get("username")
            admin_user_id = str(user_doc["_id"])

        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$set": {
                "event_admin_user_id": admin_user_id,
                "event_admin_username": admin_username,
                "updated_at": datetime.utcnow(),
            }}
        )
        updated = await self.events.find_one({"_id": ObjectId(event_id)})
        return {
            "event_id": event_id,
            "event_admin_user_id": updated.get("event_admin_user_id"),
            "event_admin_username": updated.get("event_admin_username"),
        }

    async def list_event_admin_candidates(self, event_id: str) -> List[Dict[str, Any]]:
        """Return users registered for the event (eligible to be event admin)."""
        event = await self.events.find_one({"_id": ObjectId(event_id)}, {"_id": 1})
        if not event:
            raise ValueError("Event not found")

        participants = await self.event_participants.find({"event_id": event_id}).to_list(length=2000)
        user_ids = list({p.get("user_id") for p in participants if p.get("user_id")})
        if not user_ids:
            return []

        users = await self.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}},
                                      {"username": 1, "email": 1, "team_id": 1, "team_name": 1, "team_code": 1}).to_list(length=2000)
        # Normalize
        out: List[Dict[str, Any]] = []
        for u in users:
            out.append({
                "user_id": str(u["_id"]),
                "username": u.get("username"),
                "email": u.get("email"),
                "team_id": str(u.get("team_id")) if u.get("team_id") else None,
                "team_name": u.get("team_name"),
                "team_code": u.get("team_code"),
            })
        return sorted(out, key=lambda x: (x.get("team_name") or "", x.get("username") or ""))

    async def ban_team_for_event(self, event_id: str, team_id: str) -> Dict[str, Any]:
        """Ban a team (by Mongo team_id) within an event."""
        event = await self.events.find_one({"_id": ObjectId(event_id)}, {"banned_team_ids": 1})
        if not event:
            raise ValueError("Event not found")
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$addToSet": {"banned_team_ids": str(team_id)}, "$set": {"updated_at": datetime.utcnow()}}
        )
        return {"event_id": event_id, "team_id": str(team_id), "banned": True}

    async def unban_team_for_event(self, event_id: str, team_id: str) -> Dict[str, Any]:
        """Unban a team within an event."""
        event = await self.events.find_one({"_id": ObjectId(event_id)}, {"banned_team_ids": 1})
        if not event:
            raise ValueError("Event not found")
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$pull": {"banned_team_ids": str(team_id)}, "$set": {"updated_at": datetime.utcnow()}}
        )
        return {"event_id": event_id, "team_id": str(team_id), "banned": False}

    async def get_event_banned_teams(self, event_id: str) -> List[str]:
        event = await self.events.find_one({"_id": ObjectId(event_id)}, {"banned_team_ids": 1})
        if not event:
            raise ValueError("Event not found")
        return [str(t) for t in (event.get("banned_team_ids") or [])]

    async def list_event_teams(self, event_id: str) -> List[Dict[str, Any]]:
        """List teams participating in an event and whether they are banned (team-based events)."""
        event = await self.events.find_one({"_id": ObjectId(event_id)}, {"banned_team_ids": 1, "participation_type": 1})
        if not event:
            raise ValueError("Event not found")

        banned = set(str(t) for t in (event.get("banned_team_ids") or []))
        participants = await self.event_participants.find({"event_id": event_id, "team_id": {"$ne": None}}).to_list(length=2000)
        teams_map: Dict[str, Dict[str, Any]] = {}
        for p in participants:
            tid = p.get("team_id")
            if not tid:
                continue
            tid = str(tid)
            teams_map[tid] = {
                "team_id": tid,
                "team_name": p.get("team_name"),
                "banned": tid in banned,
            }
        return sorted(list(teams_map.values()), key=lambda x: (x.get("team_name") or "", x.get("team_id")))
    
    # =========================================================================
    # Challenge Visibility
    # =========================================================================
    
    async def update_challenge_visibility(
        self,
        event_id: str,
        challenge_id: str,
        visibility: ChallengeVisibility,
        user_role: str,
        user_zone: str
    ) -> EventResponse:
        """Update visibility of a challenge within an event"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Permission check
        if user_role == "Admin" and event["zone"] != user_zone:
            raise PermissionError("Admin can only modify events in their zone")
        
        # Find and update challenge
        challenges = event.get("challenges", [])
        found = False
        for challenge in challenges:
            if challenge["challenge_id"] == challenge_id:
                challenge["visibility"] = visibility.value
                found = True
                break
        
        if not found:
            raise ValueError(f"Challenge {challenge_id} not found in event")
        
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {
                "$set": {
                    "challenges": challenges,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        updated_event = await self.events.find_one({"_id": ObjectId(event_id)})
        return self._event_to_response(updated_event)
    
    # =========================================================================
    # Participant Registration
    # =========================================================================
    
    async def register_participant(
        self,
        event_id: str,
        user_id: str,
        username: str,
        user_zone: str,
        team_id: Optional[str] = None,
        team_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Register a user/team for an event"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")

        # If team-based and team is banned for this event, block registration
        if team_id and str(team_id) in set(str(t) for t in (event.get("banned_team_ids") or [])):
            raise PermissionError("Your team is banned for this event")
        
        # Check if event accepts registrations
        if event["status"] not in [
            EventStatus.APPROVED.value, 
            EventStatus.SCHEDULED.value, 
            EventStatus.RUNNING.value
        ]:
            raise ValueError("Event is not accepting registrations")
        
        # Zone check
        if event["zone"] != user_zone and not event.get("is_public", False):
            raise PermissionError("Cannot register for events outside your zone")
        
        # Check max participants
        if event.get("max_participants"):
            current_count = await self.event_participants.count_documents({"event_id": event_id})
            if current_count >= event["max_participants"]:
                raise ValueError("Event is full")
        
        # Check if already registered
        # Team-based events should treat registration as team-level (any member counts).
        if team_id:
            participant_query = {"event_id": event_id, "team_id": team_id}
        else:
            participant_query = {"event_id": event_id, "user_id": user_id}

        existing = await self.event_participants.find_one(participant_query)
        if existing:
            # Idempotent join so frontend can safely retry without surfacing a hard error.
            return {
                "success": True,
                "message": "Already registered for this event",
                "participant_id": team_id or user_id,
                "registered_at": existing.get("registered_at") or datetime.utcnow(),
            }
        
        # Register
        now = datetime.utcnow()
        participant_doc = {
            "event_id": event_id,
            "user_id": user_id,
            "username": username,
            "zone": user_zone,
            "team_id": team_id,
            "team_name": team_name,
            "registered_at": now,
            "total_points": 0,
            "challenges_solved": 0
        }
        
        await self.event_participants.insert_one(participant_doc)
        
        # Update participant count
        await self.events.update_one(
            {"_id": ObjectId(event_id)},
            {"$inc": {"participant_count": 1}}
        )
        
        logger.info(f"User {username} registered for event {event_id}")
        
        return {
            "success": True,
            "message": "Successfully registered for event",
            "participant_id": user_id if not team_id else team_id,
            "registered_at": now
        }
    
    async def is_user_registered(self, event_id: str, user_id: str, team_id: Optional[str] = None) -> bool:
        """Check if user/team is registered for an event"""
        # Treat event-banned teams as "not registered" for access purposes
        if team_id:
            try:
                event = await self.events.find_one({"_id": ObjectId(event_id)}, {"banned_team_ids": 1})
                if event and str(team_id) in set(str(t) for t in (event.get("banned_team_ids") or [])):
                    return False
            except Exception:
                pass
        # Team-based events: registration is team-level (any member sees challenges once the team joins).
        if team_id:
            participant = await self.event_participants.find_one({"event_id": event_id, "team_id": team_id})
            return participant is not None

        participant = await self.event_participants.find_one({"event_id": event_id, "user_id": user_id})
        return participant is not None
    
    async def get_user_registered_events(self, user_id: str, team_id: Optional[str] = None) -> List[str]:
        """Get list of event IDs that the user/team is registered for"""
        if team_id:
            # Team-level registration: return events joined by this team (supports legacy docs missing user_id).
            participants = await self.event_participants.find({"team_id": team_id}, {"event_id": 1}).to_list(length=1000)
            return [str(p.get("event_id")) for p in participants if p.get("event_id")]

        participants = await self.event_participants.find({"user_id": user_id}, {"event_id": 1}).to_list(length=1000)
        return [str(p.get("event_id")) for p in participants if p.get("event_id")]

    async def cleanup_event_challenge_instances(self, event_id: str) -> None:
        """
        Stop/delete deployed challenge instances for teams registered to this event.
        Prevents stale challenge IPs from persisting into future events.
        """
        event = await self.events.find_one({"_id": ObjectId(event_id)}, {"challenges": 1})
        if not event:
            return

        challenge_ids = [c.get("challenge_id") for c in (event.get("challenges") or []) if c.get("challenge_id")]
        if not challenge_ids:
            return

        participants = await self.event_participants.find({"event_id": event_id}, {"team_id": 1}).to_list(length=5000)
        team_ids = sorted({p.get("team_id") for p in participants if p.get("team_id")})
        if not team_ids:
            return

        from app.services.challenge_service import challenge_service
        for challenge_id in challenge_ids:
            for team_id in team_ids:
                try:
                    await challenge_service.stop_challenge_for_team(challenge_id, team_id)
                except Exception as e:
                    logger.warning(
                        f"Cleanup failed for event={event_id} challenge={challenge_id} team={team_id}: {e}"
                    )
    
    async def get_challenges_from_events(self, event_ids: List[str], user_zone: str, team_id: Optional[str] = None) -> List[str]:
        """Get list of challenge IDs from events user is registered for, filtered by zone and only active events"""
        if not event_ids:
            return []
        
        # Find events user is registered for - only running or paused events
        events = await self.events.find({
            "_id": {"$in": [ObjectId(eid) for eid in event_ids]},
            "zone": user_zone,  # Only events in user's zone
            "status": {"$in": [EventStatus.RUNNING.value, EventStatus.PAUSED.value]}  # Only active events
        }).to_list(length=100)
        
        # Extract challenge IDs from these events
        challenge_ids = []
        for event in events:
            # Skip events where this team is banned
            if team_id and str(team_id) in set(str(t) for t in (event.get("banned_team_ids") or [])):
                continue
            for challenge_config in event.get("challenges", []):
                challenge_id = challenge_config.get("challenge_id")
                if challenge_id:
                    challenge_ids.append(challenge_id)
        
        return challenge_ids
    
    # =========================================================================
    # Flag Submission
    # =========================================================================
    
    async def submit_flag(
        self,
        event_id: str,
        challenge_id: str,
        user_id: str,
        username: str,
        user_zone: str,
        submitted_flag: str,
        ip_address: str,
        user_agent: Optional[str] = None,
        team_id: Optional[str] = None,
        team_name: Optional[str] = None
    ) -> SubmissionResponse:
        """Submit a flag for a challenge in an event"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")

        # If team is banned for this event, block submissions
        if team_id and str(team_id) in set(str(t) for t in (event.get("banned_team_ids") or [])):
            raise PermissionError("Your team is banned for this event")
        
        # Check event is running
        if event["status"] != EventStatus.RUNNING.value:
            raise ValueError("Event is not currently running")
        
        # Check if user/team is registered for the event
        if team_id:
            participant = await self.event_participants.find_one({"event_id": event_id, "team_id": team_id})
        else:
            participant = await self.event_participants.find_one({"event_id": event_id, "user_id": user_id})

        if not participant:
            raise ValueError("You must register for this event before submitting flags")
        
        # Find challenge in event
        event_challenge = None
        for c in event.get("challenges", []):
            if c["challenge_id"] == challenge_id:
                event_challenge = c
                break
        
        if not event_challenge:
            raise ValueError("Challenge not found in this event")
        
        # Check visibility
        if event_challenge["visibility"] == ChallengeVisibility.HIDDEN.value:
            raise ValueError("Challenge is hidden")
        
        # Check if challenge is unlocked
        if event_challenge.get("unlock_after"):
            unlock_challenge_id = event_challenge["unlock_after"]
            # Check if user/team has solved the unlock challenge
            solve_query = {
                "event_id": event_id,
                "challenge_id": unlock_challenge_id,
                "is_correct": True
            }
            if event["participation_type"] == EventParticipationType.TEAM_BASED.value and team_id:
                solve_query["team_id"] = team_id
            else:
                solve_query["user_id"] = user_id
            
            has_solved_prereq = await self.event_submissions.find_one(solve_query)
            if not has_solved_prereq:
                raise ValueError("You must solve the prerequisite challenge first")
        
        # Check max attempts
        attempt_query = {"event_id": event_id, "challenge_id": challenge_id}
        if event["participation_type"] == EventParticipationType.TEAM_BASED.value and team_id:
            attempt_query["team_id"] = team_id
        else:
            attempt_query["user_id"] = user_id

        # Count attempts before inserting this one (so we can return attempt_number)
        attempt_count = await self.event_submissions.count_documents(attempt_query)
        attempt_number = attempt_count + 1

        if event_challenge.get("max_attempts"):
            if attempt_count >= event_challenge["max_attempts"]:
                return SubmissionResponse(
                    status="max_attempts_reached",
                    points_awarded=0,
                    message="Maximum attempts reached for this challenge",
                    attempts_remaining=0
                )
        
        # Check if already solved
        solve_check_query = {
            "event_id": event_id,
            "challenge_id": challenge_id,
            "is_correct": True
        }
        if event["participation_type"] == EventParticipationType.TEAM_BASED.value and team_id:
            solve_check_query["team_id"] = team_id
        else:
            solve_check_query["user_id"] = user_id
        
        already_solved = await self.event_submissions.find_one(solve_check_query)
        if already_solved:
            return SubmissionResponse(
                status="already_solved",
                points_awarded=0,
                message="Challenge already solved"
            )
        
        # Get the actual flag from master challenge
        master_challenge = await self.challenges.find_one({"_id": ObjectId(challenge_id)})
        if not master_challenge:
            raise ValueError("Master challenge not found")
        
        correct_flag = master_challenge.get("flag", "")
        # Normalize flags: strip whitespace from both ends
        # CTF flags are typically case-sensitive, so we keep case sensitivity
        submitted_normalized = submitted_flag.strip()
        correct_normalized = correct_flag.strip()
        # Compare with case sensitivity (CTF flags are usually case-sensitive)
        is_correct = submitted_normalized == correct_normalized
        points_awarded = event_challenge["points"] if is_correct else 0
        
        # Record submission
        now = datetime.utcnow()
        # Prefer skill_category stored on event challenge, fallback to master challenge config type
        skill_category = event_challenge.get("skill_category")
        if not skill_category:
            try:
                skill_category = master_challenge.get("skill_category") or master_challenge.get("config", {}).get("challenge_type")
            except Exception:
                skill_category = None
        skill_category = skill_category or "web"
        submission_doc = {
            "event_id": event_id,
            "challenge_id": challenge_id,
            "user_id": user_id,
            "username": username,
            "zone": user_zone,
            "team_id": team_id,
            "team_name": team_name,
            "submitted_flag": submitted_flag,
            "is_correct": is_correct,
            "points_awarded": points_awarded,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "attempt_number": attempt_number,
            "skill_category": skill_category,
            "submitted_at": now
        }
        
        await self.event_submissions.insert_one(submission_doc)
        
        if is_correct:
            # Update solve count on event challenge
            await self.events.update_one(
                {"_id": ObjectId(event_id), "challenges.challenge_id": challenge_id},
                {
                    "$inc": {"challenges.$.solve_count": 1}
                }
            )
            
            # Check if first blood
            if event_challenge["solve_count"] == 0:
                first_blood = team_name if team_id else username
                await self.events.update_one(
                    {"_id": ObjectId(event_id), "challenges.challenge_id": challenge_id},
                    {
                        "$set": {
                            "challenges.$.first_blood": first_blood,
                            "challenges.$.first_blood_time": now
                        }
                    }
                )
            
            # Update participant score
            participant_query = {"event_id": event_id}
            if event["participation_type"] == EventParticipationType.TEAM_BASED.value and team_id:
                participant_query["team_id"] = team_id
            else:
                participant_query["user_id"] = user_id
            
            await self.event_participants.update_one(
                participant_query,
                {
                    "$inc": {
                        "total_points": points_awarded,
                        "challenges_solved": 1
                    }
                }
            )
            
            logger.info(f"Correct flag submitted for challenge {challenge_id} in event {event_id} by {username}")
            
            return SubmissionResponse(
                status="correct",
                points_awarded=points_awarded,
                message=f"Correct! You earned {points_awarded} points."
            )
        else:
            # Calculate remaining attempts
            attempts_remaining = None
            if event_challenge.get("max_attempts"):
                attempt_query = {
                    "event_id": event_id,
                    "challenge_id": challenge_id
                }
                if event["participation_type"] == EventParticipationType.TEAM_BASED.value and team_id:
                    attempt_query["team_id"] = team_id
                else:
                    attempt_query["user_id"] = user_id
                
                attempt_count = await self.event_submissions.count_documents(attempt_query)
                attempts_remaining = event_challenge["max_attempts"] - attempt_count
            
            return SubmissionResponse(
                status="incorrect",
                points_awarded=0,
                message="Incorrect flag. Try again!",
                attempts_remaining=attempts_remaining
            )
    
    # =========================================================================
    # Hint System
    # =========================================================================
    
    async def unlock_hint(
        self,
        event_id: str,
        challenge_id: str,
        hint_id: str,
        user_id: str,
        team_id: Optional[str] = None
    ) -> HintUnlockResponse:
        """Unlock a hint for a challenge"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Find challenge and hint
        event_challenge = None
        for c in event.get("challenges", []):
            if c["challenge_id"] == challenge_id:
                event_challenge = c
                break
        
        if not event_challenge:
            raise ValueError("Challenge not found in event")
        
        hint = None
        hint_index = -1
        for i, h in enumerate(event_challenge.get("hints", [])):
            if h["id"] == hint_id:
                hint = h
                hint_index = i
                break
        
        if not hint:
            raise ValueError("Hint not found")
        
        participant_id = team_id if team_id else user_id
        
        # Check if already unlocked
        if participant_id in hint.get("unlocked_by", []):
            return HintUnlockResponse(
                success=True,
                hint_content=hint["content"],
                points_deducted=0,
                message="Hint already unlocked"
            )
        
        # Deduct points from participant
        cost = hint.get("cost", 0)
        if cost > 0:
            participant_query = {"event_id": event_id}
            if team_id:
                participant_query["team_id"] = team_id
            else:
                participant_query["user_id"] = user_id
            
            participant = await self.event_participants.find_one(participant_query)
            if participant and participant.get("total_points", 0) < cost:
                return HintUnlockResponse(
                    success=False,
                    message=f"Insufficient points. Need {cost} points to unlock this hint."
                )
            
            await self.event_participants.update_one(
                participant_query,
                {"$inc": {"total_points": -cost}}
            )
        
        # Mark hint as unlocked
        await self.events.update_one(
            {
                "_id": ObjectId(event_id),
                "challenges.challenge_id": challenge_id,
                f"challenges.hints.id": hint_id
            },
            {
                "$push": {
                    f"challenges.$[c].hints.$[h].unlocked_by": participant_id
                }
            },
            array_filters=[
                {"c.challenge_id": challenge_id},
                {"h.id": hint_id}
            ]
        )
        
        return HintUnlockResponse(
            success=True,
            hint_content=hint["content"],
            points_deducted=cost,
            message=f"Hint unlocked! {cost} points deducted." if cost > 0 else "Hint unlocked!"
        )
    
    # =========================================================================
    # Statistics and Dashboard
    # =========================================================================
    
    async def get_live_stats(self, event_id: str, user_role: str, user_zone: str) -> EventLiveStats:
        """Get live statistics for event dashboard"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Access control
        if user_role != "Master":
            if event["zone"] != user_zone and not event.get("is_public", False):
                raise PermissionError("Access denied to this event")
        
        now = datetime.utcnow()
        
        # Basic counts
        total_participants = await self.event_participants.count_documents({"event_id": event_id})
        total_submissions = await self.event_submissions.count_documents({"event_id": event_id})
        correct_submissions = await self.event_submissions.count_documents({
            "event_id": event_id,
            "is_correct": True
        })
        incorrect_submissions = total_submissions - correct_submissions
        
        # Unique users and teams
        user_pipeline = [
            {"$match": {"event_id": event_id}},
            {"$group": {"_id": "$user_id"}}
        ]
        users = await self.event_participants.aggregate(user_pipeline).to_list(10000)
        total_users = len(users)
        
        team_pipeline = [
            {"$match": {"event_id": event_id, "team_id": {"$ne": None}}},
            {"$group": {"_id": "$team_id"}}
        ]
        teams = await self.event_participants.aggregate(team_pipeline).to_list(10000)
        total_teams = len(teams)
        
        # Challenge stats
        challenges = event.get("challenges", [])
        total_challenges = len(challenges)
        
        most_solved = None
        least_solved = None
        challenges_by_category: Dict[str, int] = {}

        # Precompute attempt counts per challenge in this event
        attempt_by_challenge: Dict[str, int] = {}
        try:
            attempt_pipeline = [
                {"$match": {"event_id": event_id}},
                {"$group": {"_id": "$challenge_id", "attempts": {"$sum": 1}}},
            ]
            attempt_rows = await self.event_submissions.aggregate(attempt_pipeline).to_list(10000)
            attempt_by_challenge = {str(r["_id"]): int(r.get("attempts", 0)) for r in attempt_rows}
        except Exception:
            attempt_by_challenge = {}
        
        for c in challenges:
            # Use skill_category for analytics (fallback to legacy challenge_category)
            category = c.get("skill_category") or c.get("challenge_category", "unknown")
            challenges_by_category[category] = challenges_by_category.get(category, 0) + 1
            
            challenge_stat = ChallengeStatsDetail(
                challenge_id=c["challenge_id"],
                challenge_name=c["challenge_name"],
                category=category,
                points=c["points"],
                solve_count=c.get("solve_count", 0),
                attempt_count=attempt_by_challenge.get(str(c["challenge_id"]), 0),
                first_blood_user=c.get("first_blood"),
                first_blood_time=c.get("first_blood_time")
            )
            
            if most_solved is None or c.get("solve_count", 0) > most_solved.solve_count:
                most_solved = challenge_stat
            if least_solved is None or c.get("solve_count", 0) < least_solved.solve_count:
                least_solved = challenge_stat
        
        # Submission rate (submissions per minute in last 5 minutes)
        five_min_ago = now - timedelta(minutes=5)
        recent_submissions = await self.event_submissions.count_documents({
            "event_id": event_id,
            "submitted_at": {"$gte": five_min_ago}
        })
        submission_rate = recent_submissions / 5.0
        
        # Top performers
        top_users = await self._get_top_users(event_id, limit=10)
        top_teams = await self._get_top_teams(event_id, limit=10)
        
        # IP mappings
        ip_pipeline = [
            {"$match": {"event_id": event_id}},
            {"$group": {
                "_id": "$user_id",
                "ips": {"$addToSet": "$ip_address"}
            }}
        ]
        ip_results = await self.event_submissions.aggregate(ip_pipeline).to_list(10000)
        ip_mappings = {str(r["_id"]): r["ips"] for r in ip_results}
        unique_ip_count = len(set(ip for ips in ip_mappings.values() for ip in ips))
        
        # Timeline (last hour, by minute)
        one_hour_ago = now - timedelta(hours=1)
        timeline_pipeline = [
            {"$match": {
                "event_id": event_id,
                "submitted_at": {"$gte": one_hour_ago}
            }},
            {"$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d %H:%M",
                        "date": "$submitted_at"
                    }
                },
                "total": {"$sum": 1},
                "correct": {"$sum": {"$cond": ["$is_correct", 1, 0]}}
            }},
            {"$sort": {"_id": 1}}
        ]
        timeline = await self.event_submissions.aggregate(timeline_pipeline).to_list(60)
        submissions_timeline = [
            {"time": t["_id"], "total": t["total"], "correct": t["correct"]}
            for t in timeline
        ]
        
        # Time calculations
        start_time = event["start_time"]
        end_time = event["end_time"]
        event_duration = int((end_time - start_time).total_seconds())
        elapsed = int((now - start_time).total_seconds()) if now > start_time else 0
        time_remaining = int((end_time - now).total_seconds()) if now < end_time else 0
        
        # Category proficiency
        category_proficiency = await self._calculate_category_proficiency(event_id)
        
        return EventLiveStats(
            event_id=event_id,
            event_name=event["name"],
            event_status=EventStatus(event["status"]),
            total_participants=total_participants,
            total_users=total_users,
            total_teams=total_teams,
            total_challenges=total_challenges,
            total_submissions=total_submissions,
            correct_submissions=correct_submissions,
            incorrect_submissions=incorrect_submissions,
            submission_rate_per_minute=submission_rate,
            most_solved_challenge=most_solved,
            least_solved_challenge=least_solved,
            challenges_by_category=challenges_by_category,
            top_users=top_users,
            top_teams=top_teams,
            category_proficiency_distribution=category_proficiency,
            unique_ip_count=unique_ip_count,
            ip_mappings=ip_mappings,
            submissions_timeline=submissions_timeline,
            time_remaining_seconds=time_remaining if time_remaining > 0 else None,
            event_duration_seconds=event_duration,
            elapsed_seconds=elapsed
        )
    
    async def get_scoreboard(
        self,
        event_id: str,
        user_role: str,
        user_zone: str
    ) -> EventScoreboardResponse:
        """Get event scoreboard"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Access control
        if user_role != "Master":
            if event["zone"] != user_zone and not event.get("is_public", False):
                raise PermissionError("Access denied to this event")
        
        participation_type = EventParticipationType(event["participation_type"])
        
        if participation_type == EventParticipationType.TEAM_BASED:
            entries = await self._get_team_scoreboard(event_id)
        else:
            entries = await self._get_user_scoreboard(event_id)
        
        return EventScoreboardResponse(
            event_id=event_id,
            event_name=event["name"],
            participation_type=participation_type,
            scoreboard=entries,
            total_entries=len(entries),
            last_updated=datetime.utcnow()
        )
    
    async def get_user_stats(
        self,
        event_id: str,
        user_id: str,
        user_role: str,
        user_zone: str
    ) -> UserStats:
        """Get statistics for a specific user in an event"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Access control
        if user_role != "Master":
            if event["zone"] != user_zone and not event.get("is_public", False):
                raise PermissionError("Access denied to this event")
        
        # Get participant record
        participant = await self.event_participants.find_one({
            "event_id": event_id,
            "user_id": user_id
        })
        
        if not participant:
            raise ValueError("User not registered for this event")
        
        # Get submission stats
        pipeline = [
            {"$match": {"event_id": event_id, "user_id": user_id}},
            {"$group": {
                "_id": None,
                "total_submissions": {"$sum": 1},
                "correct_submissions": {"$sum": {"$cond": ["$is_correct", 1, 0]}},
                "ips": {"$addToSet": "$ip_address"}
            }}
        ]
        stats_result = await self.event_submissions.aggregate(pipeline).to_list(1)
        stats = stats_result[0] if stats_result else {
            "total_submissions": 0,
            "correct_submissions": 0,
            "ips": []
        }
        
        # Get first bloods
        first_bloods = 0
        for c in event.get("challenges", []):
            if c.get("first_blood") == participant["username"]:
                first_bloods += 1
        
        # Category proficiency
        category_proficiency = await self._get_user_category_proficiency(event_id, user_id)
        
        # Last submission
        last_sub = await self.event_submissions.find_one(
            {"event_id": event_id, "user_id": user_id},
            sort=[("submitted_at", -1)]
        )
        
        return UserStats(
            user_id=user_id,
            username=participant["username"],
            zone=participant.get("zone", "unknown"),
            total_points=participant.get("total_points", 0),
            challenges_solved=participant.get("challenges_solved", 0),
            total_submissions=stats["total_submissions"],
            correct_submissions=stats["correct_submissions"],
            incorrect_submissions=stats["total_submissions"] - stats["correct_submissions"],
            first_bloods=first_bloods,
            category_proficiency=category_proficiency,
            ip_addresses=stats.get("ips", []),
            last_submission_at=last_sub["submitted_at"] if last_sub else None
        )
    
    async def get_team_stats(
        self,
        event_id: str,
        team_id: str,
        user_role: str,
        user_zone: str
    ) -> TeamStats:
        """Get statistics for a specific team in an event"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            raise ValueError("Event not found")
        
        # Access control
        if user_role != "Master":
            if event["zone"] != user_zone and not event.get("is_public", False):
                raise PermissionError("Access denied to this event")
        
        # Get team participants
        participants = await self.event_participants.find({
            "event_id": event_id,
            "team_id": team_id
        }).to_list(1000)
        
        if not participants:
            raise ValueError("Team not registered for this event")
        
        team_name = participants[0].get("team_name", "Unknown Team")
        zone = participants[0].get("zone", "unknown")
        
        # Aggregate team stats
        total_points = sum(p.get("total_points", 0) for p in participants)
        challenges_solved = sum(p.get("challenges_solved", 0) for p in participants)
        
        # Get submission stats
        pipeline = [
            {"$match": {"event_id": event_id, "team_id": team_id}},
            {"$group": {
                "_id": None,
                "total_submissions": {"$sum": 1},
                "correct_submissions": {"$sum": {"$cond": ["$is_correct", 1, 0]}},
                "ips": {"$addToSet": "$ip_address"}
            }}
        ]
        stats_result = await self.event_submissions.aggregate(pipeline).to_list(1)
        stats = stats_result[0] if stats_result else {
            "total_submissions": 0,
            "correct_submissions": 0,
            "ips": []
        }
        
        # Get first bloods
        first_bloods = 0
        for c in event.get("challenges", []):
            if c.get("first_blood") == team_name:
                first_bloods += 1
        
        # Member stats
        members = []
        for p in participants:
            member_stats = await self.get_user_stats(event_id, p["user_id"], user_role, user_zone)
            members.append(member_stats)
        
        # Category proficiency
        category_proficiency = await self._get_team_category_proficiency(event_id, team_id)
        
        # Last submission
        last_sub = await self.event_submissions.find_one(
            {"event_id": event_id, "team_id": team_id},
            sort=[("submitted_at", -1)]
        )
        
        return TeamStats(
            team_id=team_id,
            team_name=team_name,
            zone=zone,
            total_points=total_points,
            challenges_solved=challenges_solved,
            total_submissions=stats["total_submissions"],
            correct_submissions=stats["correct_submissions"],
            incorrect_submissions=stats["total_submissions"] - stats["correct_submissions"],
            first_bloods=first_bloods,
            member_count=len(participants),
            members=members,
            category_proficiency=category_proficiency,
            ip_addresses=stats.get("ips", []),
            last_submission_at=last_sub["submitted_at"] if last_sub else None
        )
    
    # =========================================================================
    # Available Challenges for Event Creation
    # =========================================================================
    
    async def get_available_challenges(self, zone: Optional[str] = None, user_zone: Optional[str] = None, user_role: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get active challenges for event creation, filtered by zone.
        
        - If zone is provided, only return challenges for that zone (or challenges without zone field)
        - Master Admin can see all challenges
        - Zone Admin can only see challenges in their zone
        """
        query = {"is_active": True}
        
        # Zone filtering
        if zone:
            # Filter by specific zone when creating event
            # Include challenges that match the zone OR challenges without a zone field (legacy support)
            query["$or"] = [
                {"zone": zone},
                {"zone": {"$exists": False}},  # Legacy challenges without zone field
                {"zone": None},  # Challenges with null zone
                {"zone": ""}  # Challenges with empty zone
            ]
        elif user_role == "Admin" and user_zone:
            # Zone Admin can only see challenges in their zone (or without zone)
            query["$or"] = [
                {"zone": user_zone},
                {"zone": {"$exists": False}},
                {"zone": None},
                {"zone": ""}
            ]
        # Master Admin sees all challenges (no zone filter)
        
        cursor = self.challenges.find(query)
        challenges = await cursor.to_list(1000)
        
        return [
            {
                "id": str(c["_id"]),
                "name": c["name"],
                "description": c["description"],
                "category": c.get("challenge_category", "containerized"),
                "skill_category": c.get("skill_category") or c.get("config", {}).get("challenge_type", "web") or "web",
                "challenge_type": c.get("config", {}).get("challenge_type", "web"),
                "points": c.get("points", 100),
                "is_active": c.get("is_active", True),
                "zone": c.get("zone", "zone1"),  # Default to zone1 for challenges without zone
                "created_by": str(c.get("created_by", ""))
            }
            for c in challenges
        ]
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    async def _notify_teams_event_started(self, event: Dict) -> None:
        """Notify all users in the event's zone that the event has started"""
        try:
            event_zone = event.get("zone")
            event_name = event.get("name", "Event")
            event_id = str(event.get("_id"))
            
            # Get all users in the event's zone (not just teams)
            users = await self.users.find({
                "zone": event_zone,
                "is_active": True,
                "role": {"$ne": "Master"}  # Don't notify Master admins
            }).to_list(length=10000)
            
            # Create notifications for each user
            notifications = []
            for user in users:
                user_id = str(user.get("_id"))
                team_id = user.get("team_id")
                
                notification = {
                    "type": "event_started",
                    "event_id": event_id,
                    "event_name": event_name,
                    "zone": event_zone,
                    "user_id": user_id,
                    "username": user.get("username"),
                    "team_id": str(team_id) if team_id else None,
                    "team_code": user.get("team_code"),
                    "message": f"Event '{event_name}' has started in your zone ({event_zone})! Click to join and start solving challenges.",
                    "action": "join_event",  # Action type for frontend
                    "created_at": datetime.utcnow(),
                    "read": False
                }
                notifications.append(notification)
            
            # Insert notifications into database (create notifications collection if needed)
            if notifications:
                await self.db["notifications"].insert_many(notifications)
                logger.info(f"Sent {len(notifications)} notifications for event {event_id} to users in zone {event_zone}")
        except Exception as e:
            logger.error(f"Failed to send notifications for event {event.get('_id')}: {e}")
    
    def _event_to_response(self, event: Dict) -> EventResponse:
        """Convert event document to response schema"""
        def _as_utc(dt: Any) -> Any:
            """Ensure datetimes are timezone-aware UTC so frontend parsing doesn't drift."""
            if isinstance(dt, datetime):
                # Mongo often stores naive datetimes; treat them as UTC
                if dt.tzinfo is None:
                    return dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            return dt

        challenges = []
        for c in event.get("challenges", []):
            hints = []
            for h in c.get("hints", []):
                hints.append(HintResponse(
                    id=h["id"],
                    content=h["content"],
                    hint_type=h["hint_type"],
                    cost=h.get("cost", 0),
                    order=h.get("order", 1),
                    unlocked_by=h.get("unlocked_by", []),
                    created_at=h.get("created_at", datetime.utcnow())
                ))
            
            challenges.append(EventChallengeResponse(
                challenge_id=c["challenge_id"],
                challenge_name=c["challenge_name"],
                challenge_category=c.get("challenge_category", "containerized"),
                skill_category=c.get("skill_category") or c.get("challenge_category") or "web",
                description=c["description"],
                visibility=ChallengeVisibility(c.get("visibility", "visible")),
                points=c["points"],
                order=c.get("order", 1),
                unlock_after=c.get("unlock_after"),
                hints=hints,
                max_attempts=c.get("max_attempts"),
                is_unlocked=True,  # Will be computed per user in actual use
                solve_count=c.get("solve_count", 0),
                first_blood=c.get("first_blood")
            ))
        
        return EventResponse(
            id=str(event["_id"]),
            name=event["name"],
            description=event["description"],
            event_type=EventType(event["event_type"]),
            participation_type=EventParticipationType(event["participation_type"]),
            zone=event["zone"],
            start_time=_as_utc(event["start_time"]),
            end_time=_as_utc(event["end_time"]),
            max_participants=event.get("max_participants"),
            is_public=event.get("is_public", False),
            status=EventStatus(event["status"]),
            challenges=challenges,
            created_by=str(event["created_by"]),
            created_by_username=event.get("created_by_username", "unknown"),
            approved_by=event.get("approved_by"),
            approval_comments=event.get("approval_comments"),
            approved_at=_as_utc(event.get("approved_at")),
            paused_at=_as_utc(event.get("paused_at")),
            pause_reason=event.get("pause_reason"),
            participant_count=event.get("participant_count", 0),
            event_admin_user_id=event.get("event_admin_user_id"),
            event_admin_username=event.get("event_admin_username"),
            banned_team_ids=[str(t) for t in (event.get("banned_team_ids") or [])],
            created_at=_as_utc(event["created_at"]),
            updated_at=_as_utc(event["updated_at"])
        )
    
    async def _get_top_users(self, event_id: str, limit: int = 10) -> List[UserStats]:
        """Get top users by points"""
        cursor = self.event_participants.find({
            "event_id": event_id
        }).sort("total_points", -1).limit(limit)
        
        participants = await cursor.to_list(limit)
        
        users = []
        for p in participants:
            users.append(UserStats(
                user_id=str(p["user_id"]),
                username=p["username"],
                zone=p.get("zone", "unknown"),
                total_points=p.get("total_points", 0),
                challenges_solved=p.get("challenges_solved", 0)
            ))
        
        return users
    
    async def _get_top_teams(self, event_id: str, limit: int = 10) -> List[TeamStats]:
        """Get top teams by points"""
        pipeline = [
            {"$match": {"event_id": event_id, "team_id": {"$ne": None}}},
            {"$group": {
                "_id": "$team_id",
                "team_name": {"$first": "$team_name"},
                "zone": {"$first": "$zone"},
                "total_points": {"$sum": "$total_points"},
                "challenges_solved": {"$sum": "$challenges_solved"},
                "member_count": {"$sum": 1}
            }},
            {"$sort": {"total_points": -1}},
            {"$limit": limit}
        ]
        
        results = await self.event_participants.aggregate(pipeline).to_list(limit)
        
        teams = []
        for r in results:
            teams.append(TeamStats(
                team_id=str(r["_id"]) if r["_id"] else None,
                team_name=r.get("team_name", "Unknown"),
                zone=r.get("zone", "unknown"),
                total_points=r.get("total_points", 0),
                challenges_solved=r.get("challenges_solved", 0),
                member_count=r.get("member_count", 0)
            ))
        
        return teams
    
    async def _get_user_scoreboard(self, event_id: str) -> List[ScoreboardEntry]:
        """Get user-based scoreboard"""
        cursor = self.event_participants.find({
            "event_id": event_id
        }).sort([("total_points", -1), ("challenges_solved", -1)])
        
        participants = await cursor.to_list(1000)
        
        entries = []
        for i, p in enumerate(participants):
            # Get last solve time
            last_solve = await self.event_submissions.find_one(
                {"event_id": event_id, "user_id": p["user_id"], "is_correct": True},
                sort=[("submitted_at", -1)]
            )
            
            entries.append(ScoreboardEntry(
                rank=i + 1,
                participant_id=str(p["user_id"]),
                participant_name=p["username"],
                zone=p.get("zone", "unknown"),
                total_points=p.get("total_points", 0),
                challenges_solved=p.get("challenges_solved", 0),
                last_solve_time=last_solve["submitted_at"] if last_solve else None
            ))
        
        return entries
    
    async def _get_team_scoreboard(self, event_id: str) -> List[ScoreboardEntry]:
        """Get team-based scoreboard"""
        pipeline = [
            {"$match": {"event_id": event_id, "team_id": {"$ne": None}}},
            {"$group": {
                "_id": "$team_id",
                "team_name": {"$first": "$team_name"},
                "zone": {"$first": "$zone"},
                "total_points": {"$sum": "$total_points"},
                "challenges_solved": {"$sum": "$challenges_solved"}
            }},
            {"$sort": {"total_points": -1, "challenges_solved": -1}}
        ]
        
        results = await self.event_participants.aggregate(pipeline).to_list(1000)
        
        entries = []
        for i, r in enumerate(results):
            # Get last solve time for team
            last_solve = await self.event_submissions.find_one(
                {"event_id": event_id, "team_id": r["_id"], "is_correct": True},
                sort=[("submitted_at", -1)]
            )
            
            entries.append(ScoreboardEntry(
                rank=i + 1,
                participant_id=str(r["_id"]),
                participant_name=r.get("team_name", "Unknown"),
                zone=r.get("zone", "unknown"),
                total_points=r.get("total_points", 0),
                challenges_solved=r.get("challenges_solved", 0),
                last_solve_time=last_solve["submitted_at"] if last_solve else None
            ))
        
        return entries
    
    async def _calculate_category_proficiency(self, event_id: str) -> Dict[str, Dict[str, Any]]:
        """Calculate category proficiency distribution for all participants"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            return {}
        
        category_stats: Dict[str, Dict[str, Any]] = {}
        challenges = event.get("challenges", []) or []

        # Build lookup: challenge_id -> category (skill_category preferred)
        cid_to_cat: Dict[str, str] = {}
        for c in challenges:
            cat = c.get("skill_category") or c.get("challenge_category") or "unknown"
            cid_to_cat[str(c.get("challenge_id"))] = cat

        # Initialize totals from event definition (points, solves)
        for c in challenges:
            category = c.get("skill_category") or c.get("challenge_category", "unknown")
            if category not in category_stats:
                category_stats[category] = {
                    "total_challenges": 0,
                    "total_solves": 0,
                    "total_attempts": 0,
                    "total_points_available": 0,
                    "total_points_earned": 0
                }
            
            category_stats[category]["total_challenges"] += 1
            category_stats[category]["total_solves"] += c.get("solve_count", 0)
            category_stats[category]["total_points_available"] += c["points"]
            category_stats[category]["total_points_earned"] += c["points"] * c.get("solve_count", 0)

        # Count attempts per category from submissions (challenge_id -> category)
        try:
            attempt_rows = await self.event_submissions.aggregate([
                {"$match": {"event_id": event_id}},
                {"$group": {"_id": "$challenge_id", "attempts": {"$sum": 1}}},
            ]).to_list(10000)

            for r in attempt_rows:
                cid = str(r.get("_id"))
                cat = cid_to_cat.get(cid, "unknown")
                if cat not in category_stats:
                    category_stats[cat] = {
                        "total_challenges": 0,
                        "total_solves": 0,
                        "total_attempts": 0,
                        "total_points_available": 0,
                        "total_points_earned": 0
                    }
                category_stats[cat]["total_attempts"] += int(r.get("attempts", 0))
        except Exception:
            pass
        
        return category_stats
    
    async def _get_user_category_proficiency(
        self, 
        event_id: str, 
        user_id: str
    ) -> Dict[str, Dict[str, Any]]:
        """Get category proficiency for a specific user"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            return {}
        
        # Get user's correct submissions
        correct_subs = await self.event_submissions.find({
            "event_id": event_id,
            "user_id": user_id,
            "is_correct": True
        }).to_list(1000)
        
        solved_challenge_ids = {s["challenge_id"] for s in correct_subs}
        
        # Get user's all attempts
        all_subs = await self.event_submissions.find({
            "event_id": event_id,
            "user_id": user_id
        }).to_list(10000)
        
        attempted_challenge_ids = {s["challenge_id"] for s in all_subs}
        
        category_stats = {}
        for c in event.get("challenges", []):
            category = c.get("skill_category") or c.get("challenge_category", "unknown")
            if category not in category_stats:
                category_stats[category] = {
                    "solved": 0,
                    "attempted": 0,
                    "points": 0,
                    "total_in_category": 0
                }
            
            category_stats[category]["total_in_category"] += 1
            
            if c["challenge_id"] in solved_challenge_ids:
                category_stats[category]["solved"] += 1
                category_stats[category]["points"] += c["points"]
            
            if c["challenge_id"] in attempted_challenge_ids:
                category_stats[category]["attempted"] += 1
        
        return category_stats
    
    async def _get_team_category_proficiency(
        self, 
        event_id: str, 
        team_id: str
    ) -> Dict[str, Dict[str, Any]]:
        """Get category proficiency for a specific team"""
        event = await self.events.find_one({"_id": ObjectId(event_id)})
        if not event:
            return {}
        
        # Get team's correct submissions
        correct_subs = await self.event_submissions.find({
            "event_id": event_id,
            "team_id": team_id,
            "is_correct": True
        }).to_list(1000)
        
        solved_challenge_ids = {s["challenge_id"] for s in correct_subs}
        
        # Get team's all attempts
        all_subs = await self.event_submissions.find({
            "event_id": event_id,
            "team_id": team_id
        }).to_list(10000)
        
        attempted_challenge_ids = {s["challenge_id"] for s in all_subs}
        
        category_stats = {}
        for c in event.get("challenges", []):
            category = c.get("skill_category") or c.get("challenge_category", "unknown")
            if category not in category_stats:
                category_stats[category] = {
                    "solved": 0,
                    "attempted": 0,
                    "points": 0,
                    "total_in_category": 0
                }
            
            category_stats[category]["total_in_category"] += 1
            
            if c["challenge_id"] in solved_challenge_ids:
                category_stats[category]["solved"] += 1
                category_stats[category]["points"] += c["points"]
            
            if c["challenge_id"] in attempted_challenge_ids:
                category_stats[category]["attempted"] += 1
        
        return category_stats
    
    async def _notify_teams_event_started(self, event: Dict) -> None:
        """Notify all users in the event's zone that the event has started"""
        try:
            event_zone = event.get("zone")
            event_name = event.get("name", "Event")
            event_id = str(event.get("_id"))
            
            # Get all users in the event's zone (not just teams)
            users = await self.users.find({
                "zone": event_zone,
                "is_active": True,
                "role": {"$ne": "Master"}  # Don't notify Master admins
            }).to_list(length=10000)
            
            # Create notifications for each user
            notifications = []
            for user in users:
                user_id = str(user.get("_id"))
                team_id = user.get("team_id")
                
                notification = {
                    "type": "event_started",
                    "event_id": event_id,
                    "event_name": event_name,
                    "zone": event_zone,
                    "user_id": user_id,
                    "username": user.get("username"),
                    "team_id": str(team_id) if team_id else None,
                    "team_code": user.get("team_code"),
                    "message": f"Event '{event_name}' has started in your zone ({event_zone})! Click to join and start solving challenges.",
                    "action": "join_event",  # Action type for frontend
                    "created_at": datetime.utcnow(),
                    "read": False
                }
                notifications.append(notification)
            
            # Insert notifications into database (create notifications collection if needed)
            if notifications:
                await self.db["notifications"].insert_many(notifications)
                logger.info(f"Sent {len(notifications)} notifications for event {event_id} to users in zone {event_zone}")
        except Exception as e:
            logger.error(f"Failed to send notifications for event {event.get('_id')}: {e}")


# Global instance
event_service = EventService()

