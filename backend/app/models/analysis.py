from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserAnalysisSnapshot(Base):
    __tablename__ = "user_analysis_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    asd_risk_score = Column(Float, nullable=True)
    mood_trend_score = Column(Float, nullable=True)
    task_performance_score = Column(Float, nullable=True)
    overall_risk_index = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    model_version = Column(String(50), nullable=True)

    user = relationship("User", back_populates="analysis_snapshots")
    recommendations = relationship("Recommendation", back_populates="analysis_snapshot")
