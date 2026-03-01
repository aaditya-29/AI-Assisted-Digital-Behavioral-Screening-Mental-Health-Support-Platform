"""
Admin Schemas

Pydantic models for admin-related requests and responses.
"""
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.user import UserRole


class UserListResponse(BaseModel):
    """Extended user response for admin views."""
    id: int
    email: str
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PaginatedUsers(BaseModel):
    """Paginated list of users."""
    users: List[UserListResponse]
    total: int
    skip: int
    limit: int


class UserRoleUpdate(BaseModel):
    """Request to update user role."""
    role: UserRole


class UserStatusUpdate(BaseModel):
    """Request to update user active status."""
    is_active: bool


class SystemStatsResponse(BaseModel):
    """System-wide statistics for admin dashboard."""
    total_users: int
    active_users: int
    users_by_role: Dict[str, int]
    total_screenings: int
    completed_screenings: int
    risk_distribution: Dict[str, int]
    total_journal_entries: int
    total_task_sessions: int
    completed_task_sessions: int


class RecentActivityResponse(BaseModel):
    """Recent activity statistics."""
    period_days: int
    new_users: int
    screenings: int
    journal_entries: int
    task_sessions: int
