"""
Professional Routes

Endpoints for healthcare professionals to view shared patient data.
Requires PROFESSIONAL or ADMIN role.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User, UserRole
from app.models.professional import (
    ProfessionalProfile,
    ConsultationRequest,
    ProfessionalNote
)
from app.models.screening import ScreeningSession
from app.models.analysis import UserAnalysisSnapshot
from app.models.journal import JournalEntry
from app.models.task import TaskSession
from app.schemas.professional import (
    ProfessionalProfileCreate,
    ProfessionalProfileResponse,
    ProfessionalProfileUpdate,
    ConsultationRequestResponse,
    ConsultationRequestUpdate,
    ProfessionalNoteCreate,
    ProfessionalNoteResponse,
    SharedPatientSummary,
    PatientDetailView
)
from app.utils.dependencies import get_professional_user, get_current_user
from app.routes.notifications import create_notification

router = APIRouter(prefix="/professional", tags=["Professional"])


# =============================================================================
# Professional Profile Management
# =============================================================================

@router.post("/profile", response_model=ProfessionalProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_professional_profile(
    profile_data: ProfessionalProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a professional profile for the current user.
    Automatically upgrades user role to PROFESSIONAL if approved.
    """
    # Check if profile already exists
    existing = db.query(ProfessionalProfile).filter(
        ProfessionalProfile.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Professional profile already exists"
        )
    
    profile = ProfessionalProfile(
        user_id=current_user.id,
        license_number=profile_data.license_number,
        specialty=profile_data.specialty,
        institution=profile_data.institution,
        is_verified=False  # Requires admin verification
    )
    
    db.add(profile)
    db.commit()
    db.refresh(profile)
    
    return profile


@router.get("/profile", response_model=ProfessionalProfileResponse)
async def get_my_professional_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's professional profile."""
    profile = db.query(ProfessionalProfile).filter(
        ProfessionalProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professional profile not found"
        )
    
    return profile


@router.patch("/profile", response_model=ProfessionalProfileResponse)
async def update_professional_profile(
    profile_update: ProfessionalProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current user's professional profile."""
    profile = db.query(ProfessionalProfile).filter(
        ProfessionalProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professional profile not found"
        )
    
    update_data = profile_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    
    db.commit()
    db.refresh(profile)
    
    return profile


# =============================================================================
# Professional Stats
# =============================================================================

@router.get("/stats")
async def get_professional_stats(
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """Get aggregated stats for the professional dashboard."""
    # Accepted patient IDs
    patient_ids = [
        r.user_id for r in db.query(ConsultationRequest.user_id).filter(
            ConsultationRequest.professional_id == professional.id,
            ConsultationRequest.status == "accepted"
        ).all()
    ]
    total_patients = len(patient_ids)
    active_patients = total_patients  # all accepted are active

    total_screenings = 0
    completed_screenings = 0
    total_journal_entries = 0
    total_task_sessions = 0
    completed_task_sessions = 0

    if patient_ids:
        total_screenings = db.query(func.count(ScreeningSession.id)).filter(
            ScreeningSession.user_id.in_(patient_ids)
        ).scalar() or 0
        completed_screenings = db.query(func.count(ScreeningSession.id)).filter(
            ScreeningSession.user_id.in_(patient_ids),
            ScreeningSession.completed_at.isnot(None)
        ).scalar() or 0
        total_journal_entries = db.query(func.count(JournalEntry.id)).filter(
            JournalEntry.user_id.in_(patient_ids)
        ).scalar() or 0
        total_task_sessions = db.query(func.count(TaskSession.id)).filter(
            TaskSession.user_id.in_(patient_ids)
        ).scalar() or 0
        completed_task_sessions = db.query(func.count(TaskSession.id)).filter(
            TaskSession.user_id.in_(patient_ids),
            TaskSession.completed_at.isnot(None)
        ).scalar() or 0

    return {
        "total_patients": total_patients,
        "active_patients": active_patients,
        "total_screenings": total_screenings,
        "completed_screenings": completed_screenings,
        "total_journal_entries": total_journal_entries,
        "total_task_sessions": total_task_sessions,
        "completed_task_sessions": completed_task_sessions,
    }


# =============================================================================
# Consultation Requests (User shares data with professional)
# =============================================================================

@router.get("/consultations", response_model=List[ConsultationRequestResponse])
async def get_my_consultation_requests(
    status_filter: Optional[str] = Query(None, regex="^(pending|accepted|declined)$"),
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Get all consultation requests sent to this professional.
    Professional only.
    """
    query = db.query(ConsultationRequest).filter(
        ConsultationRequest.professional_id == professional.id
    )
    
    if status_filter:
        query = query.filter(ConsultationRequest.status == status_filter)
    
    requests = query.order_by(ConsultationRequest.created_at.desc()).all()

    # Return enriched objects including patient name so frontend can display it
    out = []
    for r in requests:
        out.append({
            "id": r.id,
            "user_id": r.user_id,
            "professional_id": r.professional_id,
            "first_name": r.user.first_name if r.user else None,
            "last_name": r.user.last_name if r.user else None,
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "message": r.message,
            "created_at": r.created_at,
        })
    return out


@router.patch("/consultations/{request_id}", response_model=ConsultationRequestResponse)
async def update_consultation_request(
    request_id: int,
    request_update: ConsultationRequestUpdate,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Accept or decline a consultation request.
    Professional only.
    """
    consultation = db.query(ConsultationRequest).filter(
        ConsultationRequest.id == request_id,
        ConsultationRequest.professional_id == professional.id
    ).first()
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation request not found"
        )
    
    # If accepting, ensure no duplicate accepted consultations exist
    new_status = request_update.status
    if new_status == "accepted":
        existing_accepted = db.query(ConsultationRequest).filter(
            ConsultationRequest.user_id == consultation.user_id,
            ConsultationRequest.professional_id == professional.id,
            ConsultationRequest.status == "accepted",
            ConsultationRequest.id != consultation.id
        ).first()
        if existing_accepted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An accepted consultation already exists for this patient and professional"
            )

    consultation.status = new_status
    db.commit()
    db.refresh(consultation)

    # Notify the patient about the decision
    if new_status == "accepted":
        create_notification(
            db, consultation.user_id, "consultation_accepted",
            "Consultation Accepted",
            f"Dr. {professional.first_name} {professional.last_name} has accepted your data-sharing request.",
            "/connect-professional"
        )
    elif new_status == "declined":
        create_notification(
            db, consultation.user_id, "consultation_declined",
            "Consultation Declined",
            f"Dr. {professional.first_name} {professional.last_name} has declined your data-sharing request.",
            "/connect-professional"
        )

    return consultation


# =============================================================================
# View Shared Patient Data
# =============================================================================

@router.get("/patients", response_model=List[SharedPatientSummary])
async def get_shared_patients(
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Get list of patients who have shared their data with this professional.
    Only shows patients with accepted consultation requests.
    """
    # Get all users who have shared data with this professional
    shared_users = db.query(User).join(
        ConsultationRequest,
        ConsultationRequest.user_id == User.id
    ).filter(
        ConsultationRequest.professional_id == professional.id,
        ConsultationRequest.status == "accepted"
    ).all()
    
    summaries = []
    for user in shared_users:
        # Get latest screening
        latest_screening = db.query(ScreeningSession).filter(
            ScreeningSession.user_id == user.id,
            ScreeningSession.completed_at.isnot(None)
        ).order_by(ScreeningSession.completed_at.desc()).first()
        
        # Get latest analysis
        latest_analysis = db.query(UserAnalysisSnapshot).filter(
            UserAnalysisSnapshot.user_id == user.id
        ).order_by(UserAnalysisSnapshot.created_at.desc()).first()
        
        summaries.append(SharedPatientSummary(
            user_id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            last_screening_date=latest_screening.completed_at if latest_screening else None,
            last_risk_level=latest_screening.risk_level if latest_screening else None,
            last_analysis_date=latest_analysis.created_at if latest_analysis else None
        ))
    
    return summaries


@router.get("/patients/{patient_id}", response_model=PatientDetailView)
async def get_patient_detail(
    patient_id: int,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed view of a shared patient's data.
    Professional only. Requires accepted consultation request.
    """
    # Verify professional has access to this patient
    consultation = db.query(ConsultationRequest).filter(
        ConsultationRequest.user_id == patient_id,
        ConsultationRequest.professional_id == professional.id,
        ConsultationRequest.status == "accepted"
    ).first()
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this patient's data"
        )
    
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Get screening history
    screenings = db.query(ScreeningSession).filter(
        ScreeningSession.user_id == patient_id,
        ScreeningSession.completed_at.isnot(None)
    ).order_by(ScreeningSession.completed_at.desc()).limit(10).all()
    
    # Get latest analysis
    latest_analysis = db.query(UserAnalysisSnapshot).filter(
        UserAnalysisSnapshot.user_id == patient_id
    ).order_by(UserAnalysisSnapshot.created_at.desc()).first()
    
    # Get professional's notes on this patient
    notes = db.query(ProfessionalNote).filter(
        ProfessionalNote.user_id == patient_id,
        ProfessionalNote.professional_id == professional.id
    ).order_by(ProfessionalNote.created_at.desc()).all()
    
    return PatientDetailView(
        user_id=patient.id,
        first_name=patient.first_name,
        last_name=patient.last_name,
        screenings=[{
            "id": s.id,
            "completed_at": s.completed_at,
            "raw_score": s.raw_score,
            "risk_level": s.risk_level.value if s.risk_level else None,
            "ml_probability": s.ml_risk_score,
            "ml_probability_label": s.ml_probability_label,
            "family_asd": s.family_asd,
            "jaundice": s.jaundice,
            "completed_by": s.completed_by,
            "age_group_used": s.age_group_used,
        } for s in screenings],
        latest_analysis={
            "created_at": latest_analysis.created_at,
            "composite_score": latest_analysis.composite_score,
            "primary_areas": latest_analysis.primary_areas,
            "trend_direction": latest_analysis.trend_direction
        } if latest_analysis else None,
        notes=[{
            "id": n.id,
            "content": n.content,
            "created_at": n.created_at
        } for n in notes],
        consultation_date=consultation.created_at
    )


# =============================================================================
# Professional Notes
# =============================================================================

@router.post("/patients/{patient_id}/notes", response_model=ProfessionalNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_professional_note(
    patient_id: int,
    note_data: ProfessionalNoteCreate,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Add a professional note about a patient.
    Professional only. Requires accepted consultation request.
    """
    # Verify professional has access to this patient
    consultation = db.query(ConsultationRequest).filter(
        ConsultationRequest.user_id == patient_id,
        ConsultationRequest.professional_id == professional.id,
        ConsultationRequest.status == "accepted"
    ).first()
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this patient's data"
        )
    
    note = ProfessionalNote(
        user_id=patient_id,
        professional_id=professional.id,
        content=note_data.content
    )
    
    db.add(note)
    db.commit()
    db.refresh(note)

    # Notify the patient
    create_notification(
        db, patient_id, "note_added",
        "New Professional Note",
        f"Dr. {professional.first_name} {professional.last_name} has added a note to your profile.",
        "/dashboard"
    )

    return note


@router.get("/patients/{patient_id}/notes", response_model=List[ProfessionalNoteResponse])
async def get_patient_notes(
    patient_id: int,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Get all notes for a patient written by this professional.
    Professional only.
    """
    # Verify professional has access to this patient
    consultation = db.query(ConsultationRequest).filter(
        ConsultationRequest.user_id == patient_id,
        ConsultationRequest.professional_id == professional.id,
        ConsultationRequest.status == "accepted"
    ).first()
    
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this patient's data"
        )
    
    notes = db.query(ProfessionalNote).filter(
        ProfessionalNote.user_id == patient_id,
        ProfessionalNote.professional_id == professional.id
    ).order_by(ProfessionalNote.created_at.desc()).all()
    
    return notes


@router.get("/patients/{patient_id}/screenings/{session_id}")
async def get_patient_screening_detail(
    patient_id: int,
    session_id: int,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Get full details of a patient's screening session including all Q&A responses.
    Professional only. Requires accepted consultation request.
    """
    # Verify access
    consultation = db.query(ConsultationRequest).filter(
        ConsultationRequest.user_id == patient_id,
        ConsultationRequest.professional_id == professional.id,
        ConsultationRequest.status == "accepted"
    ).first()
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this patient's data"
        )

    from app.services.screening_service import ScreeningService

    service = ScreeningService(db)
    try:
        session, detailed_responses = service.get_session_with_responses(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screening session not found"
        )

    if session.user_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return {
        "id": session.id,
        "completed_at": session.completed_at,
        "raw_score": session.raw_score,
        "risk_level": session.risk_level.value if session.risk_level else None,
        "ml_probability": session.ml_risk_score,
        "ml_probability_label": session.ml_probability_label,
        "family_asd": session.family_asd,
        "jaundice": session.jaundice,
        "completed_by": session.completed_by,
        "age_group_used": session.age_group_used,
        "responses": detailed_responses,
    }
