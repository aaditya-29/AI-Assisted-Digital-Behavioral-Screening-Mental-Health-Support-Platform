"""
Screening Schemas

Pydantic models for AQ-10 screening questionnaire requests and responses.
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# =============================================================================
# Question & Option Schemas
# =============================================================================

class OptionResponse(BaseModel):
    """Option response for displaying in questionnaire."""
    id: int
    text: str
    
    class Config:
        from_attributes = True


class QuestionResponse(BaseModel):
    """Question with its options for displaying in questionnaire."""
    id: int
    label: Optional[str] = None
    text: str
    category: Optional[str]
    options: List[OptionResponse]
    
    class Config:
        from_attributes = True


class QuestionnaireResponse(BaseModel):
    """Full AQ-10 questionnaire with all questions."""
    questions: List[QuestionResponse]
    total_questions: int


# =============================================================================
# Screening Session Schemas
# =============================================================================

class ScreeningStart(BaseModel):
    """Response when starting a new screening session."""
    session_id: int
    started_at: datetime
    questions: List[QuestionResponse]
    age_group: Optional[str] = None


class ScreeningStartRequest(BaseModel):
    """Request body for starting a screening with pre-screening data."""
    family_asd: Optional[str] = None        # "yes" / "no"
    jaundice: Optional[str] = None           # "yes" / "no"
    completed_by: Optional[str] = None       # who completed the test


class AnswerSubmit(BaseModel):
    """Single answer submission."""
    question_id: int
    selected_option_id: int
    response_time_ms: Optional[int] = Field(None, ge=0, description="Time taken to answer in milliseconds")


class BulkAnswerSubmit(BaseModel):
    """Bulk submission of all answers at once."""
    answers: List[AnswerSubmit]


class ScreeningResponseItem(BaseModel):
    """Individual response in a screening session."""
    question_id: int
    question_text: str
    selected_option_id: int
    selected_option_text: str
    score_value: int
    response_time_ms: Optional[int]
    
    class Config:
        from_attributes = True


class ScreeningResultResponse(BaseModel):
    """Result of a completed screening session."""
    session_id: int
    user_id: int
    started_at: datetime
    completed_at: datetime
    raw_score: int
    max_score: int
    risk_level: str
    risk_description: str
    ml_prediction: Optional[int] = None          # 0 = no ASD traits, 1 = ASD traits present
    ml_probability_label: Optional[str] = None   # low / moderate / high / very_high
    ml_risk_score: Optional[float] = None
    question_scores: Optional[dict] = None       # per-question scores + demographics JSON
    # Pre-screening / profile fields stored with the session
    family_asd: Optional[str] = None
    jaundice: Optional[str] = None
    completed_by: Optional[str] = None
    age_group_used: Optional[str] = None
    responses: List[ScreeningResponseItem]
    recommendations: List[str]


class ScreeningSessionSummary(BaseModel):
    """Summary of a screening session for history view."""
    id: int
    started_at: datetime
    completed_at: Optional[datetime]
    raw_score: Optional[int]
    risk_level: Optional[str]
    is_complete: bool
    # ML fields
    ml_probability_label: Optional[str] = None
    ml_risk_score: Optional[float] = None      # actual probability (0.0–1.0)
    # Pre-screening / profile fields
    family_asd: Optional[str] = None
    jaundice: Optional[str] = None
    completed_by: Optional[str] = None
    age_group_used: Optional[str] = None
    
    class Config:
        from_attributes = True


class ScreeningHistoryResponse(BaseModel):
    """User's screening history."""
    screenings: List[ScreeningSessionSummary]
    total: int


# =============================================================================
# Risk Level Information
# =============================================================================

class RiskLevelInfo(BaseModel):
    """Information about a risk level."""
    level: str
    score_range: str
    description: str
    recommendations: List[str]


class RiskLevelsResponse(BaseModel):
    """All risk level information."""
    levels: List[RiskLevelInfo]
