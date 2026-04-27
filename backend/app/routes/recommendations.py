"""
Recommendations Routes

API endpoints for viewing AI-generated recommendations.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.recommendation import Recommendation, RecommendationStatus, Resource
from app.utils.dependencies import get_current_active_user
from app.utils.crypto import decrypt_text
from app.services.recommendation_service import (
    check_and_update_recommendations,
    trigger_batch_complete_check,
)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


# =============================================================================
# Schemas
# =============================================================================

class ResourceBrief(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    type: str
    content_or_url: Optional[str] = None

    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    id: int
    reason: str
    status: str
    resource: Optional[ResourceBrief] = None
    redirect_link: Optional[str] = None
    batch_id: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RecommendationsListResponse(BaseModel):
    summary: Optional[str] = None
    recommendations: List[RecommendationResponse]
    has_recommendations: bool


class CheckTaskRequest(BaseModel):
    task_category: str
    difficulty_level: int = 1


class CheckTaskResponse(BaseModel):
    matched: bool
    recommendation_id: Optional[int] = None
    batch_complete: bool
    new_analysis_triggered: bool


class DismissRequest(BaseModel):
    comment: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================

@router.get("", response_model=RecommendationsListResponse)
async def get_my_recommendations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get the current user's latest AI-generated recommendations (full batch only).
    Professional-assigned recommendations are served by /recommendations/professional.
    """
    # Find latest batch
    latest = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == current_user.id,
            Recommendation.batch_id.isnot(None),
        )
        .order_by(desc(Recommendation.created_at))
        .first()
    )

    if not latest:
        return RecommendationsListResponse(summary=None, recommendations=[], has_recommendations=False)

    recs = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == current_user.id,
            Recommendation.batch_id == latest.batch_id,
        )
        .order_by(Recommendation.created_at)
        .all()
    )

    if not recs:
        return RecommendationsListResponse(
            summary=None,
            recommendations=[],
            has_recommendations=False,
        )

    # Extract summary (special row)
    summary = None
    task_recs = []
    for r in recs:
        decrypted_reason = decrypt_text(r.reason) if r.reason else r.reason
        if decrypted_reason and decrypted_reason.startswith("[SUMMARY]"):
            summary = decrypted_reason.replace("[SUMMARY] ", "").replace("[SUMMARY]", "")
        else:
            resource_brief = None
            if r.resource_id:
                res = db.query(Resource).filter(Resource.id == r.resource_id).first()
                if res:
                    resource_brief = ResourceBrief(
                        id=res.id,
                        title=res.title,
                        description=res.description,
                        type=res.type.value if hasattr(res.type, "value") else str(res.type),
                        content_or_url=res.content_or_url,
                    )
            task_recs.append(RecommendationResponse(
                id=r.id,
                reason=decrypted_reason or "",
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                resource=resource_brief,
                redirect_link=r.redirect_link,
                batch_id=r.batch_id,
                comment=r.comment,
                created_at=r.created_at,
            ))

    return RecommendationsListResponse(
        summary=summary,
        recommendations=task_recs,
        has_recommendations=bool(task_recs),
    )


# =============================================================================
# Professional-assigned recommendations (separate from AI batch)
# =============================================================================

class ProfessionalRecResponse(BaseModel):
    id: int
    reason: str
    status: str
    resource: Optional[ResourceBrief] = None
    redirect_link: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/professional", response_model=List[ProfessionalRecResponse])
async def get_my_professional_recommendations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get professional-assigned recommendations for the current user.
    These are standalone recs (batch_id IS NULL) — separate from AI batches.
    """
    recs = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == current_user.id,
            Recommendation.batch_id.is_(None),
        )
        .order_by(desc(Recommendation.created_at))
        .all()
    )

    items = []
    for r in recs:
        decrypted_reason = decrypt_text(r.reason) if r.reason else r.reason
        resource_brief = None
        if r.resource_id:
            res = db.query(Resource).filter(Resource.id == r.resource_id).first()
            if res:
                resource_brief = ResourceBrief(
                    id=res.id,
                    title=res.title,
                    description=res.description,
                    type=res.type.value if hasattr(res.type, "value") else str(res.type),
                    content_or_url=res.content_or_url,
                )
        items.append(ProfessionalRecResponse(
            id=r.id,
            reason=decrypted_reason or "",
            status=r.status.value if hasattr(r.status, "value") else str(r.status),
            resource=resource_brief,
            redirect_link=r.redirect_link,
            comment=r.comment,
            created_at=r.created_at,
        ))
    return items


@router.post("/check", response_model=CheckTaskResponse)
async def check_task_completion(
    body: CheckTaskRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Called after a task submission. Checks if the submitted task matches a
    pending recommendation. If the entire batch is done, triggers new analysis.
    """
    result = check_and_update_recommendations(
        user_id=current_user.id,
        task_category=body.task_category,
        difficulty_level=body.difficulty_level,
        db=db,
    )
    return CheckTaskResponse(**result)


@router.patch("/{rec_id}/dismiss", status_code=status.HTTP_200_OK)
async def dismiss_recommendation(
    rec_id: int,
    body: Optional[DismissRequest] = None,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Mark a recommendation as dismissed, optionally with a comment."""
    rec = db.query(Recommendation).filter(
        Recommendation.id == rec_id,
        Recommendation.user_id == current_user.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    # Prevent users from dismissing AI-generated task recommendations.
    # Rule: if this recommendation belongs to an AI batch (batch_id != None)
    # and is not a resource (resource_id is None), disallow user dismissal.
    if rec.batch_id is not None and rec.resource_id is None:
        raise HTTPException(status_code=403, detail="You cannot dismiss AI-generated task recommendations. Please discuss with your professional.")

    rec.status = RecommendationStatus.DISMISSED
    if body and body.comment:
        rec.comment = body.comment
    db.commit()

    # If this rec belongs to an AI batch, check async whether the batch is now complete
    if rec.batch_id is not None and background_tasks is not None:
        background_tasks.add_task(trigger_batch_complete_check, current_user.id, db)

    return {"message": "Recommendation dismissed"}


@router.patch("/{rec_id}/complete", status_code=status.HTTP_200_OK)
async def complete_recommendation(
    rec_id: int,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Mark a recommendation as completed."""
    rec = db.query(Recommendation).filter(
        Recommendation.id == rec_id,
        Recommendation.user_id == current_user.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec.status = RecommendationStatus.COMPLETED
    db.commit()

    # If this rec belongs to an AI batch, check async whether the batch is now complete
    if rec.batch_id is not None and background_tasks is not None:
        background_tasks.add_task(trigger_batch_complete_check, current_user.id, db)

    return {"message": "Recommendation completed"}
