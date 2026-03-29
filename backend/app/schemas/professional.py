"""
Professional Schemas

Pydantic models for professional-related requests and responses.
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


# =============================================================================
# Professional Profile Schemas
# =============================================================================

class ProfessionalProfileCreate(BaseModel):
    """Request to create a professional profile."""
    license_number: str = Field(..., min_length=1, max_length=100)
    specialty: str = Field(..., min_length=1, max_length=100)
    institution: Optional[str] = Field(None, max_length=200)


class ProfessionalProfileUpdate(BaseModel):
    """Request to update a professional profile."""
    specialty: Optional[str] = Field(None, max_length=100)
    institution: Optional[str] = Field(None, max_length=200)


class ProfessionalProfileResponse(BaseModel):
    """Professional profile response."""
    id: int
    user_id: int
    license_number: str
    specialty: str
    institution: Optional[str]
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# =============================================================================
# Consultation Request Schemas
# =============================================================================

class ConsultationRequestCreate(BaseModel):
    """Request to share data with a professional (from user perspective)."""
    professional_id: int
    message: Optional[str] = Field(None, max_length=1000)


class ConsultationRequestUpdate(BaseModel):
    """Update consultation request status (from professional perspective)."""
    status: str = Field(..., pattern="^(accepted|declined)$")


class ConsultationRequestResponse(BaseModel):
    """Consultation request response."""
    id: int
    user_id: int
    professional_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: str
    message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# =============================================================================
# Professional Note Schemas
# =============================================================================

class ProfessionalNoteCreate(BaseModel):
    """Request to create a professional note."""
    content: str = Field(..., min_length=1, max_length=5000)


class ProfessionalNoteResponse(BaseModel):
    """Professional note response."""
    id: int
    user_id: int
    professional_id: int
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# =============================================================================
# Shared Patient Data Schemas
# =============================================================================

class SharedPatientSummary(BaseModel):
    """Summary view of a shared patient."""
    user_id: int
    first_name: str
    last_name: str
    last_screening_date: Optional[datetime]
    last_risk_level: Optional[str]
    last_analysis_date: Optional[datetime]


class ScreeningSummary(BaseModel):
    """Brief screening summary for patient view."""
    id: int
    completed_at: datetime
    raw_score: int
    risk_level: str


class AnalysisSummary(BaseModel):
    """Brief analysis summary for patient view."""
    created_at: datetime
    composite_score: float
    primary_areas: Optional[Dict[str, Any]]
    trend_direction: Optional[str]


class NoteSummary(BaseModel):
    """Brief note summary."""
    id: int
    content: str
    created_at: datetime


class PatientDetailView(BaseModel):
    """Detailed view of a patient's shared data."""
    user_id: int
    first_name: str
    last_name: str
    screenings: List[Dict[str, Any]]
    latest_analysis: Optional[Dict[str, Any]]
    notes: List[Dict[str, Any]]
    consultation_date: datetime


# =============================================================================
# Professional Search/Discovery Schemas
# =============================================================================

class ProfessionalSearchResult(BaseModel):
    """Search result for finding professionals."""
    user_id: int
    first_name: str
    last_name: str
    specialty: str
    institution: Optional[str]
    is_verified: bool
