"""
Analysis Routes

Provides aggregated behavioral analysis data for the dashboard.
"""
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.journal import JournalEntry
from app.models.screening import ScreeningSession, RiskLevel
from app.utils.dependencies import get_current_active_user
from app.utils.crypto import decrypt_text

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.get("/summary")
async def get_analysis_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Return an aggregated behavioral snapshot for the current user.

    Includes:
    - Journal mood & stress trends (last 30 days)
    - Screening history summary (last 5 completed)
    - Combined risk insight
    """
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # ── Journal stats ───────────────────────────────────────────────────────
    journal_entries = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == current_user.id,
            JournalEntry.created_at >= thirty_days_ago,
        )
        .order_by(JournalEntry.created_at.asc())
        .all()
    )

    mood_scores = [e.mood_rating for e in journal_entries if e.mood_rating is not None]
    stress_scores = [e.stress_rating for e in journal_entries if e.stress_rating is not None]

    avg_mood = round(sum(mood_scores) / len(mood_scores), 1) if mood_scores else None
    avg_stress = round(sum(stress_scores) / len(stress_scores), 1) if stress_scores else None

    # Weekly mood/stress aggregates (4 weeks)
    weekly_mood: dict = {}
    weekly_stress: dict = {}
    for entry in journal_entries:
        week_label = entry.created_at.strftime("W%U")
        if entry.mood_rating is not None:
            weekly_mood.setdefault(week_label, []).append(entry.mood_rating)
        if entry.stress_rating is not None:
            weekly_stress.setdefault(week_label, []).append(entry.stress_rating)

    mood_trend = [
        {"week": w, "avg": round(sum(v) / len(v), 1)}
        for w, v in sorted(weekly_mood.items())
    ]
    stress_trend = [
        {"week": w, "avg": round(sum(v) / len(v), 1)}
        for w, v in sorted(weekly_stress.items())
    ]

    # Mood category label
    def mood_label(score: Optional[float]) -> str:
        if score is None:
            return "No data"
        if score >= 8:
            return "Excellent"
        if score >= 6:
            return "Good"
        if score >= 4:
            return "Neutral"
        if score >= 2:
            return "Low"
        return "Very Low"

    def stress_label(score: Optional[float]) -> str:
        if score is None:
            return "No data"
        if score >= 8:
            return "High"
        if score >= 5:
            return "Moderate"
        return "Low"

    # ── Screening stats ─────────────────────────────────────────────────────
    screenings = (
        db.query(ScreeningSession)
        .filter(
            ScreeningSession.user_id == current_user.id,
            ScreeningSession.completed_at.isnot(None),
        )
        .order_by(ScreeningSession.completed_at.desc())
        .limit(5)
        .all()
    )

    screening_history = [
        {
            "id": s.id,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "raw_score": s.raw_score,
            "risk_level": s.risk_level.value if s.risk_level else None,
            "ml_prediction": s.ml_prediction,
            "ml_probability_label": s.ml_probability_label,
        }
        for s in screenings
    ]

    latest_screening = screenings[0] if screenings else None
    latest_risk = latest_screening.risk_level.value if latest_screening and latest_screening.risk_level else None
    latest_ml_label = latest_screening.ml_probability_label if latest_screening else None

    # ── Combined insight ────────────────────────────────────────────────────
    def combined_insight(risk: Optional[str], mood: Optional[float], stress: Optional[float]) -> str:
        parts = []
        if risk in ("high", "very_high"):
            parts.append("Your latest screening indicates elevated ASD traits.")
        elif risk == "moderate":
            parts.append("Your latest screening suggests some ASD-related traits to watch.")
        elif risk == "low":
            parts.append("Your latest screening shows a low likelihood of ASD traits.")

        if stress is not None and stress >= 7:
            parts.append("Your stress levels have been notably high recently.")
        elif stress is not None and stress >= 5:
            parts.append("Moderate stress levels detected in your recent journals.")

        if mood is not None and mood < 4:
            parts.append("Your mood scores are below average — consider reaching out for support.")
        elif mood is not None and mood >= 7:
            parts.append("Your mood has been positive — keep up the great work!")

        if not parts:
            parts.append("Keep tracking your mood and screening regularly for personalised insights.")
        return " ".join(parts)

    insight = combined_insight(latest_ml_label or latest_risk, avg_mood, avg_stress)

    return {
        "journal": {
            "entry_count_30d": len(journal_entries),
            "avg_mood": avg_mood,
            "avg_stress": avg_stress,
            "mood_label": mood_label(avg_mood),
            "stress_label": stress_label(avg_stress),
            "mood_trend": mood_trend,
            "stress_trend": stress_trend,
        },
        "screening": {
            "total_completed": len(screenings),
            "latest_risk_level": latest_risk,
            "latest_ml_prediction": latest_screening.ml_prediction if latest_screening else None,
            "latest_ml_label": latest_ml_label,
            "latest_raw_score": latest_screening.raw_score if latest_screening else None,
            "history": screening_history,
        },
        "insight": insight,
    }
