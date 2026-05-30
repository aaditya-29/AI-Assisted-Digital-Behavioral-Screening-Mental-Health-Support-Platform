from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLEnum, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    USER = "user"
    PROFESSIONAL = "professional"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(50), nullable=True)
    ethnicity = Column(String(100), nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Existing relationships
    email_verifications = relationship(
        "EmailVerification",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    screening_sessions = relationship("ScreeningSession", back_populates="user", cascade="all, delete-orphan")
    task_sessions = relationship("TaskSession", back_populates="user", cascade="all, delete-orphan")
    journal_entries = relationship("JournalEntry", back_populates="user", cascade="all, delete-orphan")
    analysis_snapshots = relationship("UserAnalysisSnapshot", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    consent_logs = relationship("ConsentLog", back_populates="user", cascade="all, delete-orphan")

    # Consultation requests (as patient)
    consultation_requests = relationship(
        "ConsultationRequest",
        foreign_keys="[ConsultationRequest.user_id]",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Professional profile (1-to-1)
    professional_profile = relationship(
        "ProfessionalProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    # Additional screening instruments (RAADS-R, CAST, SCQ, SRS-2)
    additional_screenings = relationship("AdditionalScreening", back_populates="user", cascade="all, delete-orphan")

    # Comorbidity screenings (PHQ-9, GAD-7, ASRS)
    comorbidity_screenings = relationship("ComorbidityScreening", back_populates="user", cascade="all, delete-orphan")

    # Structured behavioral observations
    behavioral_observations = relationship(
        "BehavioralObservation",
        foreign_keys="[BehavioralObservation.user_id]",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Referrals
    referrals = relationship(
        "Referral",
        foreign_keys="[Referral.user_id]",
        back_populates="user",
        cascade="all, delete-orphan"
    )