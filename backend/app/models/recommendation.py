from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ResourceType(str, enum.Enum):
    ARTICLE = "article"
    VIDEO = "video"
    EXERCISE = "exercise"
    GUIDE = "guide"
    TOOL = "tool"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(SQLEnum(ResourceType), nullable=False)
    content_or_url = Column(Text, nullable=True)
    target_risk_level = Column(SQLEnum(RiskLevel), nullable=True)
    # uploaded_by: null = admin/system, else user_id of professional
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # patient_id: null = global resource, else specific patient
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    recommendations = relationship("Recommendation", back_populates="resource")


class RecommendationStatus(str, enum.Enum):
    PENDING = "pending"
    VIEWED = "viewed"
    COMPLETED = "completed"
    DISMISSED = "dismissed"


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="SET NULL"), nullable=True, index=True)
    analysis_snapshot_id = Column(Integer, ForeignKey("user_analysis_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    batch_id = Column(String(36), nullable=True, index=True)  # UUID grouping recs from same analysis
    reason = Column(Text, nullable=True)
    redirect_link = Column(Text, nullable=True)
    comment = Column(Text, nullable=True)  # Dismissal reason / professional note
    status = Column(SQLEnum(RecommendationStatus), default=RecommendationStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="recommendations")
    resource = relationship("Resource", back_populates="recommendations")
    analysis_snapshot = relationship("UserAnalysisSnapshot", back_populates="recommendations")
