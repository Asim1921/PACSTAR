"""
Event Schemas for CTF Events and Cyber Exercises

This module defines Pydantic models for event management including:
- Event creation, update, and response schemas
- Event types (CTF, Cyber Exercise)
- Participation modes (User-based, Team-based)
- Scoring and statistics schemas
- Hint types (Alert, Background, Toast)
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from enum import Enum


class EventType(str, Enum):
    """Type of event"""
    CTF = "ctf"
    CYBER_EXERCISE = "cyber_exercise"


class EventParticipationType(str, Enum):
    """Participation mode for the event"""
    USER_BASED = "user_based"
    TEAM_BASED = "team_based"


class EventStatus(str, Enum):
    """Status of an event"""
    DRAFT = "draft"                        # Initial creation, not yet submitted for approval
    PENDING_APPROVAL = "pending_approval"  # Submitted for Master Admin approval
    APPROVED = "approved"                  # Approved by Master Admin
    REJECTED = "rejected"                  # Rejected by Master Admin
    SCHEDULED = "scheduled"                # Approved and scheduled to start
    RUNNING = "running"                    # Event is currently active
    PAUSED = "paused"                      # Event is temporarily paused
    COMPLETED = "completed"                # Event has ended
    CANCELLED = "cancelled"                # Event was cancelled


class HintType(str, Enum):
    """Type of hint display"""
    ALERT = "alert"            # Full-screen alert style
    BACKGROUND = "background"  # Subtle background notification
    TOAST = "toast"            # Toast notification


class ChallengeVisibility(str, Enum):
    """Challenge visibility in an event"""
    VISIBLE = "visible"
    HIDDEN = "hidden"


# ============================================================================
# Hint Schemas
# ============================================================================

class HintBase(BaseModel):
    """Base schema for hints"""
    content: str = Field(..., min_length=1, max_length=1000, description="Hint content/text")
    hint_type: HintType = Field(default=HintType.TOAST, description="How the hint should be displayed")
    cost: int = Field(default=0, ge=0, description="Point cost to unlock this hint")
    order: int = Field(default=1, ge=1, description="Order in which hints are revealed")


class HintCreate(HintBase):
    """Schema for creating a hint"""
    pass


class HintResponse(HintBase):
    """Schema for hint response"""
    id: str = Field(..., description="Hint ID")
    unlocked_by: List[str] = Field(default_factory=list, description="List of user/team IDs who unlocked this hint")
    created_at: datetime


# ============================================================================
# Event Challenge Schemas
# ============================================================================

class EventChallengeConfig(BaseModel):
    """Configuration for a challenge within an event"""
    challenge_id: str = Field(..., description="Reference to the master challenge ID")
    visibility: ChallengeVisibility = Field(default=ChallengeVisibility.VISIBLE)
    points_override: Optional[int] = Field(None, ge=1, description="Override points for this event")
    order: int = Field(default=1, ge=1, description="Display order in the event")
    unlock_after: Optional[str] = Field(None, description="Challenge ID that must be solved before this unlocks")
    hints: List[HintCreate] = Field(default_factory=list, description="Hints for this challenge in this event")
    max_attempts: Optional[int] = Field(None, ge=1, description="Max submission attempts (None = unlimited)")


class EventChallengeResponse(BaseModel):
    """Response schema for event challenge"""
    challenge_id: str
    challenge_name: str
    challenge_category: str
    description: str
    visibility: ChallengeVisibility
    points: int
    order: int
    unlock_after: Optional[str]
    hints: List[HintResponse] = Field(default_factory=list)
    max_attempts: Optional[int]
    is_unlocked: bool = Field(default=True, description="Whether this challenge is unlocked for the viewer")
    solve_count: int = Field(default=0, description="Number of solves in this event")
    first_blood: Optional[str] = Field(None, description="First solver (user/team)")


# ============================================================================
# Event Base Schemas
# ============================================================================

class EventBase(BaseModel):
    """Base schema for events"""
    name: str = Field(..., min_length=3, max_length=100, description="Event name")
    description: str = Field(..., min_length=10, max_length=2000, description="Event description")
    event_type: EventType = Field(..., description="Type: CTF or Cyber Exercise")
    participation_type: EventParticipationType = Field(..., description="User-based or Team-based")
    zone: str = Field(..., min_length=2, max_length=50, description="Zone where event is created")
    start_time: datetime = Field(..., description="Event start date and time")
    end_time: datetime = Field(..., description="Event end date and time")
    max_participants: Optional[int] = Field(None, ge=1, description="Maximum participants (None = unlimited)")
    is_public: bool = Field(default=False, description="Whether event is visible to all zones")
    
    @field_validator('end_time')
    @classmethod
    def end_after_start(cls, v, info):
        if 'start_time' in info.data and v <= info.data['start_time']:
            raise ValueError('end_time must be after start_time')
        return v


class EventCreate(EventBase):
    """Schema for creating an event"""
    challenges: List[EventChallengeConfig] = Field(
        default_factory=list, 
        description="Challenges to include in this event (selected from master challenges)"
    )


class EventUpdate(BaseModel):
    """Schema for updating an event"""
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    max_participants: Optional[int] = Field(None, ge=1)
    is_public: Optional[bool] = None
    challenges: Optional[List[EventChallengeConfig]] = None


class EventApprovalRequest(BaseModel):
    """Schema for approving/rejecting an event"""
    approved: bool = Field(..., description="Whether to approve or reject")
    comments: Optional[str] = Field(None, max_length=500, description="Approval/rejection comments")


class EventPauseRequest(BaseModel):
    """Schema for pausing/resuming an event"""
    paused: bool = Field(..., description="True to pause, False to resume")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for pause/resume")


# ============================================================================
# Event Response Schemas
# ============================================================================

class EventResponse(EventBase):
    """Full event response schema"""
    id: str = Field(..., description="Event ID")
    status: EventStatus
    challenges: List[EventChallengeResponse] = Field(default_factory=list)
    created_by: str = Field(..., description="User ID who created the event")
    created_by_username: str = Field(..., description="Username who created the event")
    approved_by: Optional[str] = Field(None, description="Master Admin who approved")
    approval_comments: Optional[str] = None
    approved_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    pause_reason: Optional[str] = None
    participant_count: int = Field(default=0)
    created_at: datetime
    updated_at: datetime


class EventListResponse(BaseModel):
    """List of events response"""
    events: List[EventResponse]
    total: int


class EventSummary(BaseModel):
    """Lightweight event summary for listings"""
    id: str
    name: str
    event_type: EventType
    participation_type: EventParticipationType
    zone: str
    status: EventStatus
    start_time: datetime
    end_time: datetime
    participant_count: int
    challenge_count: int
    is_public: bool


# ============================================================================
# Submission Schemas
# ============================================================================

class FlagSubmission(BaseModel):
    """Schema for submitting a flag"""
    flag: str = Field(..., min_length=1, max_length=500, description="Submitted flag")


class SubmissionResponse(BaseModel):
    """Response for flag submission"""
    status: str = Field(..., description="correct, incorrect, already_solved, max_attempts_reached")
    points_awarded: int = Field(default=0)
    message: str
    attempts_remaining: Optional[int] = None


class SubmissionRecord(BaseModel):
    """Full submission record"""
    id: str
    event_id: str
    challenge_id: str
    user_id: str
    username: str
    team_id: Optional[str]
    team_name: Optional[str]
    submitted_flag: str
    is_correct: bool
    points_awarded: int
    ip_address: str
    user_agent: Optional[str]
    submitted_at: datetime


# ============================================================================
# Statistics Schemas
# ============================================================================

class UserStats(BaseModel):
    """Individual user statistics"""
    user_id: str
    username: str
    zone: str
    total_points: int = 0
    challenges_solved: int = 0
    total_submissions: int = 0
    correct_submissions: int = 0
    incorrect_submissions: int = 0
    first_bloods: int = 0
    category_proficiency: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Category-wise stats: {category: {solved: int, attempted: int, points: int}}"
    )
    ip_addresses: List[str] = Field(default_factory=list, description="IP addresses used")
    last_submission_at: Optional[datetime] = None


class TeamStats(BaseModel):
    """Team statistics"""
    team_id: str
    team_name: str
    zone: str
    total_points: int = 0
    challenges_solved: int = 0
    total_submissions: int = 0
    correct_submissions: int = 0
    incorrect_submissions: int = 0
    first_bloods: int = 0
    member_count: int = 0
    members: List[UserStats] = Field(default_factory=list)
    category_proficiency: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Category-wise stats: {category: {solved: int, attempted: int, points: int}}"
    )
    ip_addresses: List[str] = Field(default_factory=list, description="IP addresses used by team members")
    last_submission_at: Optional[datetime] = None


class ChallengeStatsDetail(BaseModel):
    """Challenge statistics within an event"""
    challenge_id: str
    challenge_name: str
    category: str
    points: int
    solve_count: int = 0
    attempt_count: int = 0
    first_blood_user: Optional[str] = None
    first_blood_team: Optional[str] = None
    first_blood_time: Optional[datetime] = None
    average_solve_time_minutes: Optional[float] = None


class EventLiveStats(BaseModel):
    """Live statistics for event dashboard"""
    event_id: str
    event_name: str
    event_status: EventStatus
    
    # Summary stats
    total_participants: int = 0
    total_users: int = 0
    total_teams: int = 0
    total_challenges: int = 0
    
    # Submission stats
    total_submissions: int = 0
    correct_submissions: int = 0
    incorrect_submissions: int = 0
    submission_rate_per_minute: float = 0.0
    
    # Challenge breakdown
    most_solved_challenge: Optional[ChallengeStatsDetail] = None
    least_solved_challenge: Optional[ChallengeStatsDetail] = None
    challenges_by_category: Dict[str, int] = Field(default_factory=dict)
    
    # Top performers
    top_users: List[UserStats] = Field(default_factory=list)
    top_teams: List[TeamStats] = Field(default_factory=list)
    
    # Category proficiency distribution (aggregate)
    category_proficiency_distribution: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    
    # IP tracking
    unique_ip_count: int = 0
    ip_mappings: Dict[str, List[str]] = Field(
        default_factory=dict, 
        description="Participant ID to IP addresses mapping"
    )
    
    # Timeline
    submissions_timeline: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Submissions over time for graphing"
    )
    
    # Event timing
    time_remaining_seconds: Optional[int] = None
    event_duration_seconds: int = 0
    elapsed_seconds: int = 0


class ScoreboardEntry(BaseModel):
    """Single entry in scoreboard"""
    rank: int
    participant_id: str  # user_id or team_id
    participant_name: str
    zone: str
    total_points: int
    challenges_solved: int
    last_solve_time: Optional[datetime] = None
    first_bloods: int = 0


class EventScoreboardResponse(BaseModel):
    """Full scoreboard response"""
    event_id: str
    event_name: str
    participation_type: EventParticipationType
    scoreboard: List[ScoreboardEntry]
    total_entries: int
    last_updated: datetime


# ============================================================================
# Hint Unlock Schemas
# ============================================================================

class HintUnlockRequest(BaseModel):
    """Request to unlock a hint"""
    hint_id: str = Field(..., description="Hint ID to unlock")


class HintUnlockResponse(BaseModel):
    """Response after unlocking a hint"""
    success: bool
    hint_content: Optional[str] = None
    points_deducted: int = 0
    message: str


# ============================================================================
# Event Registration Schemas
# ============================================================================

class EventRegistration(BaseModel):
    """Schema for event registration"""
    event_id: str


class EventRegistrationResponse(BaseModel):
    """Response for event registration"""
    success: bool
    message: str
    participant_id: str
    registered_at: datetime


# ============================================================================
# Available Challenges Schema (for event creation)
# ============================================================================

class AvailableChallengeResponse(BaseModel):
    """Available challenge for selection during event creation"""
    id: str
    name: str
    description: str
    category: str
    challenge_type: str
    points: int
    is_active: bool
    created_by: str


# ============================================================================
# Challenge Visibility Update Schema
# ============================================================================

class ChallengeVisibilityUpdate(BaseModel):
    """Update visibility of a challenge in an event"""
    challenge_id: str
    visibility: ChallengeVisibility

