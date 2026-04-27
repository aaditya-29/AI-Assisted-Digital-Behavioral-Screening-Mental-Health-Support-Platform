"""
Admin Routes

Administrative endpoints for user management and system statistics.
All routes require ADMIN role.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User, UserRole
from app.models.professional import ConsultationRequest, ConsultationStatus, ProfessionalProfile
from app.models.screening import ScreeningSession
from app.models.journal import JournalEntry
from app.models.task import TaskSession
from app.models.recommendation import Resource, ResourceType, RiskLevel
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.admin import (
    UserListResponse,
    SystemStatsResponse,
    UserRoleUpdate,
    UserStatusUpdate,
    PaginatedUsers
)
from app.schemas.professional import ConsultationRequestResponse
from app.schemas.professional import ProfessionalProfileResponse
from app.utils.dependencies import get_admin_user
from app.utils.crypto import decrypt_text
from pydantic import BaseModel


class ProfessionalVerifyRequest(BaseModel):
    is_verified: bool


class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: str
    content_or_url: Optional[str] = None
    target_risk_level: Optional[str] = None


class ResourceResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    type: str
    content_or_url: Optional[str] = None
    target_risk_level: Optional[str] = None
    uploaded_by: Optional[int] = None
    patient_id: Optional[int] = None

    class Config:
        from_attributes = True

router = APIRouter(prefix="/admin", tags=["Admin"])


class AssignPatientRequest(BaseModel):
    patient_id: int
    professional_id: int
    scheduled_time: Optional[str] = None


# =============================================================================
# User Management
# =============================================================================

@router.get("/users", response_model=PaginatedUsers)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    List all users with pagination and filtering.
    Admin only.
    """
    query = db.query(User)
    
    # Apply filters
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_term)) |
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term))
        )
    
    # Get total count
    total = query.count()
    
    # Get paginated results
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    def enrich(u: User) -> UserListResponse:
        data = UserListResponse.model_validate(u)
        # Attach is_verified and full professional profile if present
        if u.professional_profile:
            data.is_verified = u.professional_profile.is_verified
            u.professional_profile.license_number = decrypt_text(u.professional_profile.license_number) if u.professional_profile.license_number else u.professional_profile.license_number
            data.professional_profile = ProfessionalProfileResponse.model_validate(u.professional_profile)
        return data

    return PaginatedUsers(
        users=[enrich(u) for u in users],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/users/{user_id}", response_model=UserListResponse)
async def get_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific user by ID.
    Admin only.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    result = UserListResponse.model_validate(user)
    if user.professional_profile:
        result.is_verified = user.professional_profile.is_verified
        user.professional_profile.license_number = decrypt_text(user.professional_profile.license_number) if user.professional_profile.license_number else user.professional_profile.license_number
        result.professional_profile = ProfessionalProfileResponse.model_validate(user.professional_profile)
    return result


# =============================================================================
# Admin: Assign patient to professional (create accepted consultation)
# =============================================================================


@router.post("/assign-patient", response_model=ConsultationRequestResponse, status_code=status.HTTP_201_CREATED)
async def assign_patient_to_professional(
    body: AssignPatientRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Admin shortcut to assign a patient to a professional immediately.
    Creates an accepted `ConsultationRequest` unless one already exists.
    """
    # Verify patient exists
    patient = db.query(User).filter(User.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Verify professional exists and is a professional
    professional = db.query(User).filter(User.id == body.professional_id).first()
    if not professional or professional.role not in [UserRole.PROFESSIONAL, UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professional not found or not a professional user")

    # Check for existing accepted consultation
    existing = db.query(ConsultationRequest).filter(
        ConsultationRequest.user_id == body.patient_id,
        ConsultationRequest.professional_id == body.professional_id,
        ConsultationRequest.status == ConsultationStatus.ACCEPTED
    ).first()

    if existing:
        return existing

    # Create accepted consultation
    consult = ConsultationRequest(
        user_id=body.patient_id,
        professional_id=body.professional_id,
        status=ConsultationStatus.ACCEPTED
    )

    db.add(consult)
    db.commit()
    db.refresh(consult)

    return consult


@router.patch("/users/{user_id}/role", response_model=UserListResponse)
async def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update a user's role.
    Admin only. Cannot change own role.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.role = role_update.role
    db.commit()
    db.refresh(user)
    
    return user


@router.patch("/users/{user_id}/status", response_model=UserListResponse)
async def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Activate or deactivate a user account.
    Admin only. Cannot deactivate own account.
    """
    if user_id == admin.id and not status_update.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_active = status_update.is_active
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Permanently delete a user and all their data.
    Admin only. Cannot delete own account.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db.delete(user)
    db.commit()
    
    return None



@router.patch("/professionals/{user_id}/verify", response_model=UserListResponse)
async def verify_professional(
    user_id: int,
    verify: ProfessionalVerifyRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Verify or unverify a professional's profile.
    When verified, the user's role is promoted to PROFESSIONAL.
    When unverified, the role is reverted to USER.
    Admin only.
    """
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professional profile not found")

    profile.is_verified = bool(verify.is_verified)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Auto-promote / demote role based on verification status
    if verify.is_verified:
        user.role = UserRole.PROFESSIONAL
    else:
        user.role = UserRole.USER

    db.commit()
    db.refresh(user)
    db.refresh(profile)

    result = UserListResponse.model_validate(user)
    result.is_verified = profile.is_verified
    profile.license_number = decrypt_text(profile.license_number) if profile.license_number else profile.license_number
    result.professional_profile = ProfessionalProfileResponse.model_validate(profile)
    return result


# =============================================================================
# System Statistics
# =============================================================================

@router.get("/stats", response_model=SystemStatsResponse)
async def get_system_stats(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get system-wide statistics.
    Admin only.
    """
    # User statistics
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    
    users_by_role = {}
    for role in UserRole:
        count = db.query(func.count(User.id)).filter(User.role == role).scalar()
        users_by_role[role.value] = count
    
    # Screening statistics
    total_screenings = db.query(func.count(ScreeningSession.id)).scalar()
    completed_screenings = db.query(func.count(ScreeningSession.id)).filter(
        ScreeningSession.completed_at.isnot(None)
    ).scalar()
    
    # Risk level distribution
    risk_distribution = {}
    risk_counts = db.query(
        ScreeningSession.risk_level,
        func.count(ScreeningSession.id)
    ).filter(
        ScreeningSession.risk_level.isnot(None)
    ).group_by(ScreeningSession.risk_level).all()
    
    for risk_level, count in risk_counts:
        if risk_level:
            risk_distribution[risk_level] = count
    
    # Journal statistics
    total_journal_entries = db.query(func.count(JournalEntry.id)).scalar()
    
    # Task statistics
    total_task_sessions = db.query(func.count(TaskSession.id)).scalar()
    completed_task_sessions = db.query(func.count(TaskSession.id)).filter(
        TaskSession.completed_at.isnot(None)
    ).scalar()
    
    return SystemStatsResponse(
        total_users=total_users,
        active_users=active_users,
        users_by_role=users_by_role,
        total_screenings=total_screenings,
        completed_screenings=completed_screenings,
        risk_distribution=risk_distribution,
        total_journal_entries=total_journal_entries,
        total_task_sessions=total_task_sessions,
        completed_task_sessions=completed_task_sessions
    )


@router.get("/stats/recent-activity")
async def get_recent_activity(
    days: int = Query(7, ge=1, le=30),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get recent activity statistics for the past N days.
    Admin only.
    """
    from datetime import datetime, timedelta
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # New users in period
    new_users = db.query(func.count(User.id)).filter(
        User.created_at >= start_date
    ).scalar()
    
    # Screenings in period
    recent_screenings = db.query(func.count(ScreeningSession.id)).filter(
        ScreeningSession.started_at >= start_date
    ).scalar()
    
    # Journal entries in period
    recent_journals = db.query(func.count(JournalEntry.id)).filter(
        JournalEntry.created_at >= start_date
    ).scalar()
    
    # Task sessions in period
    recent_tasks = db.query(func.count(TaskSession.id)).filter(
        TaskSession.started_at >= start_date
    ).scalar()
    
    return {
        "period_days": days,
        "new_users": new_users,
        "screenings": recent_screenings,
        "journal_entries": recent_journals,
        "task_sessions": recent_tasks
    }


# =============================================================================
# Resource Management (Admin)
# =============================================================================

@router.get("/resources", response_model=List[ResourceResponse])
async def list_resources(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """List all global resources. Admin only."""
    resources = db.query(Resource).filter(Resource.patient_id == None).order_by(Resource.id.desc()).all()
    return resources


@router.post("/resources", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(
    data: ResourceCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new global resource. Admin only."""
    resource = Resource(
        title=data.title,
        description=data.description,
        type=data.type,
        content_or_url=data.content_or_url,
        target_risk_level=data.target_risk_level or None,
        uploaded_by=admin.id,
        patient_id=None
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a resource. Admin only."""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    db.delete(resource)
    db.commit()
    return None


# =============================================================================
# Professional Applications
# =============================================================================

@router.get("/professional-applications")
async def list_professional_applications(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """List pending professional applications. Admin only."""
    profiles = db.query(ProfessionalProfile).filter(
        ProfessionalProfile.is_verified == False
    ).all()
    results = []
    for p in profiles:
        user = db.query(User).filter(User.id == p.user_id).first()
        if user:
            results.append({
                "user_id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "license_number": decrypt_text(p.license_number) if p.license_number else p.license_number,
                "specialty": p.specialty,
                "institution": p.institution,
                "applied_at": p.created_at.isoformat()
            })
    return results
