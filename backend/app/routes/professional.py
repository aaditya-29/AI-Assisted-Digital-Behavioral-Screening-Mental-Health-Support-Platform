"""
Professional Routes

Endpoints for healthcare professionals to view shared patient data.
Requires PROFESSIONAL or ADMIN role.
"""
from typing import List, Optional
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User, UserRole
from app.utils.crypto import encrypt_text, decrypt_text
from app.models.professional import (
    ProfessionalProfile,
    ConsultationRequest,
    ProfessionalNote
)
from app.models.screening import ScreeningSession
from app.models.analysis import UserAnalysisSnapshot
from app.models.journal import JournalEntry
from app.models.task import Task, TaskSession, TaskResult
from app.models.recommendation import Recommendation, RecommendationStatus
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
        license_number=encrypt_text(profile_data.license_number),
        specialty=profile_data.specialty,
        institution=profile_data.institution,
        is_verified=False  # Requires admin verification
    )
    
    db.add(profile)
    db.commit()
    db.refresh(profile)
    
    profile.license_number = decrypt_text(profile.license_number) if profile.license_number else profile.license_number
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
    
    profile.license_number = decrypt_text(profile.license_number) if profile.license_number else profile.license_number
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
    
    profile.license_number = decrypt_text(profile.license_number) if profile.license_number else profile.license_number
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

    # Return enriched objects including patient name and screening summary
    out = []
    for r in requests:
        # Get screening summary for this patient
        completed_screenings = db.query(ScreeningSession).filter(
            ScreeningSession.user_id == r.user_id,
            ScreeningSession.completed_at.isnot(None)
        ).order_by(ScreeningSession.completed_at.desc()).all()

        last_screening = completed_screenings[0] if completed_screenings else None

        out.append({
            "id": r.id,
            "user_id": r.user_id,
            "professional_id": r.professional_id,
            "first_name": r.user.first_name if r.user else None,
            "last_name": r.user.last_name if r.user else None,
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "message": r.message,
            "created_at": r.created_at,
            "screening_count": len(completed_screenings),
            "last_screening_date": last_screening.completed_at if last_screening else None,
            "last_risk_level": last_screening.risk_level.value if last_screening and last_screening.risk_level else None,
            "last_ml_probability_label": last_screening.ml_probability_label if last_screening else None,
            "last_raw_score": last_screening.raw_score if last_screening else None,
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

    consultation.message = decrypt_text(consultation.message) if consultation.message else consultation.message
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
            "content": decrypt_text(n.content) if n.content else n.content,
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
        content=encrypt_text(note_data.content)
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
    
    for n in notes:
        n.content = decrypt_text(n.content) if n.content else n.content
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


# =============================================================================
# Patient Task Analytics (shared with connected professional)
# =============================================================================

@router.get("/patients/{patient_id}/task-analytics")
async def get_patient_task_analytics(
    patient_id: int,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db)
):
    """
    Get clinical task performance analytics for a shared patient.
    Includes pillar-level progression, RTCV, and weekly trends.
    Professional only. Requires accepted consultation request.
    """
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

    task_sessions = (
        db.query(TaskSession)
        .join(Task)
        .filter(
            TaskSession.user_id == patient_id,
            TaskSession.completed_at.isnot(None),
        )
        .order_by(TaskSession.completed_at.asc())
        .all()
    )

    pillar_map = {
        "executive_function": "Executive Function",
        "social_cognition": "Social Cognition",
        "joint_attention": "Joint Attention",
        "sensory_processing": "Sensory Processing",
    }

    primary_metrics = {
        "nback": "accuracy", "go_nogo": "false_alarm_rate",
        "dccs": "switch_cost_ms", "tower": "problems_solved_first_choice",
        "fer": "accuracy", "false_belief": "logical_consistency",
        "social_stories": "comprehension_score", "conversation": "cue_detection_latency",
        "rja": "accuracy", "ija": "detection_accuracy",
        "visual_temporal": "accuracy", "auditory_processing": "accuracy",
    }

    pillar_sessions = defaultdict(lambda: defaultdict(list))
    for ts in task_sessions:
        pillar = ts.task.pillar or "unknown"
        category = ts.task.category or "unknown"
        results = {r.metric_name: r.metric_value for r in ts.results}
        pillar_sessions[pillar][category].append({
            "session_id": ts.id,
            "task_name": ts.task.name,
            "difficulty_level": ts.difficulty_level,
            "completed_at": ts.completed_at.isoformat() if ts.completed_at else None,
            "metrics": results,
        })

    pillar_analytics = {}
    for pillar_key, pillar_label in pillar_map.items():
        tasks_in_pillar = pillar_sessions.get(pillar_key, {})
        if not tasks_in_pillar:
            continue

        task_summaries = []
        for category, sessions in tasks_in_pillar.items():
            primary_metric = primary_metrics.get(category, "accuracy")
            metric_values = [s["metrics"].get(primary_metric) for s in sessions if s["metrics"].get(primary_metric) is not None]

            if not metric_values:
                continue

            latest_val = metric_values[-1]
            first_val = metric_values[0]
            invert = category in ("go_nogo", "dccs", "conversation")

            if len(metric_values) >= 2:
                improvement = (first_val - latest_val) if invert else (latest_val - first_val)
                improvement_pct = (improvement / max(abs(first_val), 1)) * 100
            else:
                improvement_pct = 0.0

            # RTCV
            rtcv = None
            rt_values = [s["metrics"].get("avg_response_time") or s["metrics"].get("avg_response_latency") or s["metrics"].get("avg_detection_time") for s in sessions]
            rt_values = [v for v in rt_values if v is not None]
            if len(rt_values) >= 3:
                import statistics
                mean_rt = statistics.mean(rt_values)
                sd_rt = statistics.stdev(rt_values)
                rtcv = round((sd_rt / mean_rt) * 100, 1) if mean_rt > 0 else None

            if improvement_pct > 15: trend = "significant_improvement"
            elif improvement_pct > 5: trend = "moderate_improvement"
            elif improvement_pct > -5: trend = "stable"
            elif improvement_pct > -15: trend = "moderate_decline"
            else: trend = "significant_decline"

            weekly_data = defaultdict(list)
            for s in sessions:
                if s["completed_at"]:
                    week_label = datetime.fromisoformat(s["completed_at"]).strftime("W%U")
                    val = s["metrics"].get(primary_metric)
                    if val is not None:
                        weekly_data[week_label].append(val)

            task_summaries.append({
                "category": category,
                "task_name": sessions[-1]["task_name"],
                "total_sessions": len(sessions),
                "primary_metric": primary_metric,
                "latest_value": round(latest_val, 2),
                "first_value": round(first_val, 2),
                "improvement_pct": round(improvement_pct, 1),
                "trend": trend,
                "rtcv": rtcv,
                "max_difficulty_reached": max(s["difficulty_level"] for s in sessions),
                "weekly_progression": [
                    {"week": w, "avg": round(sum(v) / len(v), 2), "count": len(v)}
                    for w, v in sorted(weekly_data.items())
                ],
            })

        if task_summaries:
            avg_imp = sum(t["improvement_pct"] for t in task_summaries) / len(task_summaries)
            pillar_analytics[pillar_key] = {
                "label": pillar_label,
                "total_sessions": sum(len(v) for v in tasks_in_pillar.values()),
                "avg_improvement_pct": round(avg_imp, 1),
                "tasks": task_summaries,
            }

    patient = db.query(User).filter(User.id == patient_id).first()
    return {
        "patient_id": patient_id,
        "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
        "total_sessions": len(task_sessions),
        "pillar_analytics": pillar_analytics,
    }


# =============================================================================
# Patient AI Recommendations (Professional View)
# =============================================================================

@router.get("/patients/{patient_id}/recommendations")
async def get_patient_recommendations(
    patient_id: int,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db),
):
    """
    Get all recommendations for a patient (latest batch),
    including completed/dismissed ones so the professional sees the full picture.
    """
    # Verify access
    consultation = db.query(ConsultationRequest).filter(
        ConsultationRequest.user_id == patient_id,
        ConsultationRequest.professional_id == professional.id,
        ConsultationRequest.status == "accepted"
    ).first()
    if not consultation:
        raise HTTPException(status_code=403, detail="Access denied")

    # Find the latest batch_id for this patient
    latest = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == patient_id,
            Recommendation.batch_id.isnot(None),
        )
        .order_by(Recommendation.created_at.desc())
        .first()
    )
    if not latest:
        return {"batch_id": None, "summary": None, "recommendations": []}

    batch_id = latest.batch_id

    recs = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == patient_id,
            Recommendation.batch_id == batch_id,
        )
        .order_by(Recommendation.created_at)
        .all()
    )

    summary = None
    items = []
    for r in recs:
        decrypted = decrypt_text(r.reason) if r.reason else (r.reason or "")
        if decrypted.startswith("[SUMMARY]"):
            summary = decrypted.replace("[SUMMARY] ", "").replace("[SUMMARY]", "")
            continue
        items.append({
            "id": r.id,
            "reason": decrypted,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "redirect_link": r.redirect_link,
            "comment": r.comment,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "batch_id": batch_id,
        "summary": summary,
        "recommendations": items,
    }


@router.patch("/patients/{patient_id}/recommendations/{rec_id}/dismiss")
async def professional_dismiss_recommendation(
    patient_id: int,
    rec_id: int,
    body: dict,
    professional: User = Depends(get_professional_user),
    db: Session = Depends(get_db),
):
    """
    Professional dismisses a patient's recommendation with a required comment.
    """
    # Verify access
    consultation = db.query(ConsultationRequest).filter(
        ConsultationRequest.user_id == patient_id,
        ConsultationRequest.professional_id == professional.id,
        ConsultationRequest.status == "accepted"
    ).first()
    if not consultation:
        raise HTTPException(status_code=403, detail="Access denied")

    rec = db.query(Recommendation).filter(
        Recommendation.id == rec_id,
        Recommendation.user_id == patient_id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    comment = (body.get("comment") or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Comment is required when dismissing")

    rec.status = RecommendationStatus.DISMISSED
    rec.comment = f"[Professional: {professional.first_name} {professional.last_name}] {comment}"
    db.commit()

    # After dismissal, check async if the batch is now complete and trigger new analysis.
    if rec.batch_id is not None:
        from app.services.recommendation_service import trigger_batch_complete_check
        try:
            complete = trigger_batch_complete_check(patient_id, db)
            if complete:
                create_notification(
                    db, patient_id, "recommendation_updated",
                    "Recommendations Updated",
                    "Your professional updated recommendations for you. Tap to review.",
                    "/analysis?tab=recommendations",
                )
        except Exception:
            pass

    return {"message": "Recommendation dismissed by professional"}
