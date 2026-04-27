from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    mood_rating = Column(Integer, nullable=True)
    stress_rating = Column(Integer, nullable=True)
    is_shared = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="journal_entries")
    analysis = relationship("JournalAnalysis", back_populates="journal_entry", uselist=False, cascade="all, delete-orphan")


class JournalAnalysis(Base):
    __tablename__ = "journal_analyses"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # ASD-relevant attributes scored 0.0–1.0 by Gemini
    mood_valence = Column(Float, nullable=True)          # 0=very negative, 1=very positive
    anxiety_level = Column(Float, nullable=True)         # 0=none, 1=severe anxiety/worry
    social_engagement = Column(Float, nullable=True)     # 0=withdrawn/isolated, 1=actively engaged
    sensory_sensitivity = Column(Float, nullable=True)   # 0=none, 1=severe sensory issues
    emotional_regulation = Column(Float, nullable=True)  # 0=dysregulation/meltdowns, 1=well-regulated
    repetitive_behavior = Column(Float, nullable=True)   # 0=none, 1=strong fixations/routines present

    # Raw Gemini reasoning stored for auditability
    raw_reasoning = Column(Text, nullable=True)

    analyzed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    model_version = Column(String(50), nullable=True)

    journal_entry = relationship("JournalEntry", back_populates="analysis")
