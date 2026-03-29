from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class ScreeningSession(Base):
    __tablename__ = "screening_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    raw_score = Column(Integer, nullable=True)
    risk_level = Column(SQLEnum(RiskLevel), nullable=True)
    ml_risk_score = Column(Float, nullable=True)
    ml_prediction = Column(Integer, nullable=True)           # 0 or 1 from ML model
    ml_probability_label = Column(String(20), nullable=True) # low/moderate/high/very_high
    question_scores = Column(JSON, nullable=True)            # per-question scores + demographics JSON
    model_version = Column(String(50), nullable=True)
    # Pre-screening info
    family_asd = Column(String(10), nullable=True)          # "Yes" / "No"
    jaundice = Column(String(10), nullable=True)             # "Yes" / "No"
    completed_by = Column(String(50), nullable=True)         # who completed the test
    age_group_used = Column(String(20), nullable=True)       # child/adolescent/adult

    user = relationship("User", back_populates="screening_sessions")
    responses = relationship("ScreeningResponse", back_populates="screening_session", cascade="all, delete-orphan")


class AgeGroup(str, enum.Enum):
    CHILD = "child"
    ADOLESCENT = "adolescent"
    ADULT = "adult"
    ALL = "all"


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(20), nullable=True)       # e.g. "AQ1", "AQ2"
    text = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    age_group = Column(SQLEnum(AgeGroup), default=AgeGroup.ALL, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    options = relationship("Option", back_populates="question", cascade="all, delete-orphan")


class Option(Base):
    __tablename__ = "options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String(255), nullable=False)
    score_value = Column(Integer, nullable=False, default=0)

    question = relationship("Question", back_populates="options")


class ScreeningResponse(Base):
    __tablename__ = "screening_responses"

    id = Column(Integer, primary_key=True, index=True)
    screening_id = Column(Integer, ForeignKey("screening_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_option_id = Column(Integer, ForeignKey("options.id", ondelete="CASCADE"), nullable=False, index=True)
    response_time_ms = Column(Integer, nullable=True)

    screening_session = relationship("ScreeningSession", back_populates="responses")
    question = relationship("Question")
    selected_option = relationship("Option")
