"""
Team schemas for PACSTAR challenge system
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class TeamBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, description="Team name")
    description: Optional[str] = Field(None, max_length=500, description="Team description")
    max_members: int = Field(default=10, ge=1, le=50, description="Maximum team members")
    is_active: bool = Field(default=True, description="Whether the team is active")
    zone: Optional[str] = Field(None, min_length=2, max_length=50, description="Zone the team belongs to")


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    max_members: Optional[int] = Field(None, ge=1, le=50)
    is_active: Optional[bool] = None
    zone: Optional[str] = Field(None, min_length=2, max_length=50)


class TeamMember(BaseModel):
    user_id: str
    username: str
    email: str
    role: str = Field(default="member", description="Role in team: leader, member")
    joined_at: datetime


class TeamResponse(TeamBase):
    id: str
    team_code: str = Field(..., description="Unique team code for joining")
    leader_id: str = Field(..., description="User ID of team leader")
    leader_username: str
    members: List[TeamMember] = Field(default_factory=list)
    member_count: int = Field(default=0)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TeamListResponse(BaseModel):
    teams: List[TeamResponse]
    total: int


class JoinTeamRequest(BaseModel):
    team_code: str = Field(..., min_length=3, max_length=20, description="Team code to join")

