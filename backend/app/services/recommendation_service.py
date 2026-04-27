"""
Recommendation Engine Service

Gathers the latest data from all user examinations (screening, journal analysis,
task results), sends it to Gemini for holistic ASD-aware analysis, and produces
actionable task + resource recommendations.

Trigger points:  after any submission (journal, screening, task).
"""
import logging
import time
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime

from google import genai
from google.genai import types
from google.genai.errors import ServerError
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.config import settings
from app.models.screening import ScreeningSession
from app.models.journal import JournalEntry, JournalAnalysis
from app.models.task import Task, TaskSession, TaskResult
from app.models.recommendation import Recommendation, Resource, RecommendationStatus
from app.models.notification import Notification
from app.utils.crypto import encrypt_text, decrypt_text

logger = logging.getLogger(__name__)

_MODEL_NAME = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# Pydantic schema for structured output
# ---------------------------------------------------------------------------

class TaskRecommendation(BaseModel):
    task_category: str = Field(..., description="Category key e.g. nback, fer, go_nogo")
    reason: str = Field(..., description="One sentence max 20 words: why this task helps right now")
    priority: int = Field(..., ge=1, le=5, description="1=most urgent, 5=least")
    level: str = Field(..., description="Recommended difficulty level: low, medium, or high")


class ResourceRecommendation(BaseModel):
    resource_id: int = Field(..., description="The exact integer ID from the AVAILABLE RESOURCES list")
    reason: str = Field(..., description="One sentence max 20 words: why this resource helps right now")


class RecommendationResult(BaseModel):
    overall_summary: str = Field(..., description="2-3 sentences max 60 words plain-English summary for a non-expert")
    risk_assessment: str = Field(..., description="low/moderate/high plus one brief reason, max 20 words")
    key_concerns: list[str] = Field(..., max_items=3, description="Top 3 concerns, one short phrase each, max 8 words per item")
    strengths: list[str] = Field(..., max_items=3, description="Top 3 positives, one short phrase each, max 8 words per item")
    recommended_tasks: list[TaskRecommendation] = Field(..., description="Tasks ordered by priority. Count MUST scale with severity: low risk = 1-2 tasks, moderate = 2-4 tasks, high = 4-6 tasks.")
    recommended_resources: list[ResourceRecommendation] = Field(default=[], description="0-3 relevant resources from AVAILABLE RESOURCES. Omit if no resources are relevant.")
    lifestyle_tips: list[str] = Field(..., max_items=3, description="Short actionable tips, max 12 words each")


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a clinical-psychology assistant for an ASD (Autism Spectrum Disorder) \
behavioral screening and support platform. You receive a structured snapshot of \
a user's latest examination data and must produce personalised recommendations.

STRICT LENGTH RULES — you MUST follow these exactly or the response will be rejected:
- overall_summary: max 60 words, 2-3 sentences.
- risk_assessment: max 20 words.
- key_concerns: max 3 items, each max 8 words.
- strengths: max 3 items, each max 8 words.
- recommended_tasks: count SCALES with severity — low risk: 1-2 tasks, moderate: 2-4 tasks, high: 4-6 tasks; each reason max 20 words; level must be exactly "low", "medium", or "high".
- recommended_resources: 0-3 items from AVAILABLE RESOURCES only; each reason max 20 words. Use empty list [] if none apply.
- lifestyle_tips: max 3 items, each max 12 words.

Other rules:
- Write for a non-expert audience; avoid jargon.
- Base recommendations strictly on the data provided.
- For recommended_tasks, only use task categories from the AVAILABLE TASKS list.
- For recommended_resources, only use IDs from the AVAILABLE RESOURCES list. If the list is empty, set recommended_resources to [].
- If data is sparse, recommend foundational tasks and encourage more engagement.
- Never diagnose — frame everything as "progress monitoring" and "support".
"""

_USER_PROMPT_TEMPLATE = """\
Analyse the following user data snapshot and return recommendations.

=== AVAILABLE TASKS (use these category keys) ===
{available_tasks}

=== AVAILABLE RESOURCES (use these exact integer IDs for recommended_resources) ===
{available_resources}

=== USER DATA SNAPSHOT ===
{user_snapshot}
"""

# All task categories the platform offers
AVAILABLE_TASK_CATEGORIES = {
    "n_back": "N-Back Working Memory (Executive Function)",
    "go_nogo": "Go/No-Go Inhibitory Control (Executive Function)",
    "dccs": "Dimensional Change Card Sort (Executive Function)",
    "tower_task": "Tower Task Planning (Executive Function)",
    "fer": "Facial Emotion Recognition (Social Cognition)",
    "false_belief": "False Belief Theory of Mind (Social Cognition)",
    "social_stories": "Social Stories Comprehension (Social Cognition)",
    "conversation": "Conversation Cue Detection (Social Cognition)",
    "joint_attention_rja": "Responding to Joint Attention (Joint Attention)",
    "joint_attention_ija": "Initiating Joint Attention (Joint Attention)",
    "visual_temporal": "Visual Temporal Processing (Sensory Processing)",
    "auditory_processing": "Auditory Processing (Sensory Processing)",
}


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------

def _gather_user_snapshot(user_id: int, db: Session) -> Optional[Dict[str, Any]]:
    """
    Collect the latest data for a user across all examinations.
    Returns None if the user has zero completed data of any kind.
    """
    snapshot: Dict[str, Any] = {}

    # 1. Latest screening
    latest_screening = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.user_id == user_id, ScreeningSession.completed_at.isnot(None))
        .order_by(desc(ScreeningSession.completed_at))
        .first()
    )
    if latest_screening:
        snapshot["screening"] = {
            "raw_score": latest_screening.raw_score,
            "risk_level": latest_screening.risk_level.value if latest_screening.risk_level else None,
            "ml_prediction": latest_screening.ml_prediction,
            "ml_probability_label": latest_screening.ml_probability_label,
            "completed_at": latest_screening.completed_at.isoformat() if latest_screening.completed_at else None,
        }

    # 2. Latest journal analyses (last 10)
    journal_analyses = (
        db.query(JournalAnalysis)
        .join(JournalEntry, JournalAnalysis.journal_id == JournalEntry.id)
        .filter(JournalEntry.user_id == user_id)
        .order_by(desc(JournalAnalysis.analyzed_at))
        .limit(10)
        .all()
    )
    if journal_analyses:
        analyses_data = []
        for ja in journal_analyses:
            analyses_data.append({
                "mood_valence": ja.mood_valence,
                "anxiety_level": ja.anxiety_level,
                "social_engagement": ja.social_engagement,
                "sensory_sensitivity": ja.sensory_sensitivity,
                "emotional_regulation": ja.emotional_regulation,
                "repetitive_behavior": ja.repetitive_behavior,
                "reasoning": decrypt_text(ja.raw_reasoning) if ja.raw_reasoning else None,
                "date": ja.analyzed_at.isoformat() if ja.analyzed_at else None,
            })
        # Compute averages for summary
        attrs = ["mood_valence", "anxiety_level", "social_engagement",
                 "sensory_sensitivity", "emotional_regulation", "repetitive_behavior"]
        avgs = {}
        for attr in attrs:
            vals = [a[attr] for a in analyses_data if a[attr] is not None]
            avgs[attr] = round(sum(vals) / len(vals), 3) if vals else None
        snapshot["journal_analysis"] = {
            "recent_count": len(analyses_data),
            "averages": avgs,
            "latest_entries": analyses_data[:3],
        }

    # 3. Latest task results — one per task category (most recent)
    # Get all distinct task categories the user has completed
    completed_sessions = (
        db.query(TaskSession)
        .join(Task)
        .filter(TaskSession.user_id == user_id, TaskSession.completed_at.isnot(None))
        .order_by(desc(TaskSession.completed_at))
        .all()
    )
    if completed_sessions:
        seen_categories = set()
        task_data = []
        for ts in completed_sessions:
            cat = ts.task.category or "unknown"
            if cat in seen_categories:
                continue
            seen_categories.add(cat)
            results = {r.metric_name: round(r.metric_value, 3) for r in ts.results}
            task_data.append({
                "task_name": ts.task.name,
                "category": cat,
                "pillar": ts.task.pillar,
                "difficulty_level": ts.difficulty_level,
                "results": results,
                "completed_at": ts.completed_at.isoformat() if ts.completed_at else None,
            })
        snapshot["task_results"] = task_data

    if not snapshot:
        return None
    return snapshot


# ---------------------------------------------------------------------------
# Gemini analysis
# ---------------------------------------------------------------------------

def _analyse_with_gemini(snapshot: Dict[str, Any], global_resources: list) -> Optional[RecommendationResult]:
    """Call Gemini structured output to produce recommendations."""
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — skipping recommendation generation.")
        return None

    available_tasks_str = "\n".join(
        f"  {k}: {v}" for k, v in AVAILABLE_TASK_CATEGORIES.items()
    )
    if global_resources:
        available_resources_str = "\n".join(
            f"  ID={r.id}: [{r.type.value if hasattr(r.type, 'value') else r.type}] {r.title} — {(r.description or '')[:80]}"
            for r in global_resources
        )
    else:
        available_resources_str = "  (none available — set recommended_resources to [])"

    import json
    snapshot_str = json.dumps(snapshot, indent=2, default=str)

    prompt = _USER_PROMPT_TEMPLATE.format(
        available_tasks=available_tasks_str,
        available_resources=available_resources_str,
        user_snapshot=snapshot_str,
    )

    model_candidates = [settings.GEMINI_MODEL_NAME] + [m for m in settings.GEMINI_FALLBACK_MODELS if m != settings.GEMINI_MODEL_NAME]
    max_attempts = max(1, settings.GEMINI_MAX_RETRY_ATTEMPTS)
    delay_seconds = max(0, settings.GEMINI_RETRY_DELAY_SECONDS)

    for model_name in model_candidates:
        for attempt in range(1, max_attempts + 1):
            try:
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=_SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        response_schema=RecommendationResult,
                        temperature=0.3,
                        max_output_tokens=4096,
                    ),
                )
                result = RecommendationResult.model_validate_json(response.text)
                if model_name != settings.GEMINI_MODEL_NAME:
                    logger.warning(
                        "Gemini fallback model used: %s after %s attempts on previous model(s).",
                        model_name,
                        attempt,
                    )
                return result
            except ServerError as err:
                status_code = getattr(err, 'status_code', None)
                msg = getattr(err, 'message', str(err))
                logger.warning(
                    "Gemini model %s attempt %s/%s failed with status %s: %s",
                    model_name,
                    attempt,
                    max_attempts,
                    status_code,
                    msg,
                )
                if attempt < max_attempts and status_code in {429, 500, 502, 503, 504}:
                    sleep_time = delay_seconds * (2 ** (attempt - 1))
                    logger.info("Retrying Gemini model %s after %s seconds.", model_name, sleep_time)
                    time.sleep(sleep_time)
                    continue
                break
            except Exception as err:
                logger.exception("Gemini recommendation call failed on model %s.", model_name)
                if attempt < max_attempts:
                    sleep_time = delay_seconds * (2 ** (attempt - 1))
                    logger.info("Retrying Gemini model %s after %s seconds due to exception.", model_name, sleep_time)
                    time.sleep(sleep_time)
                    continue
                break

        logger.warning("Model %s exhausted without success; trying next fallback model if available.", model_name)

    logger.error("All Gemini models failed to produce recommendations.")
    return None


# ---------------------------------------------------------------------------
# Persist recommendations
# ---------------------------------------------------------------------------

def _persist_recommendations(
    user_id: int,
    result: RecommendationResult,
    db: Session,
) -> None:
    """
    Clear old pending recommendations and write new ones.
    Links to matching resources if available.
    """
    # Archive old pending AI batch recommendations (not professional standalone ones)
    db.query(Recommendation).filter(
        Recommendation.user_id == user_id,
        Recommendation.status == RecommendationStatus.PENDING,
        Recommendation.batch_id.isnot(None),
    ).update({"status": RecommendationStatus.DISMISSED})

    # Generate a unique batch_id for this analysis set
    batch_id = str(uuid.uuid4())

    # Find tasks by category to link resources
    tasks_by_category = {
        t.category: t for t in db.query(Task).all() if t.category
    }

    # Find global resources (keyed by id)
    global_resources = db.query(Resource).filter(
        Resource.patient_id.is_(None)
    ).all()
    resources_by_id = {r.id: r for r in global_resources}

    # Map level string to difficulty integer
    _level_map = {"low": 1, "medium": 2, "high": 3}

    for rec in result.recommended_tasks:
        level_int = _level_map.get((rec.level or "").lower(), 2)

        # Build direct play link using actual task ID
        task_obj = tasks_by_category.get(rec.task_category)
        if task_obj:
            redirect_link = f"/tasks/{task_obj.id}/play?level={level_int}"
        else:
            redirect_link = f"/tasks?category={rec.task_category}&level={level_int}"

        recommendation = Recommendation(
            user_id=user_id,
            resource_id=None,
            batch_id=batch_id,
            reason=encrypt_text(f"[{rec.task_category}] {rec.reason}"),
            redirect_link=redirect_link,
            status=RecommendationStatus.PENDING,
        )
        db.add(recommendation)

    # Persist AI-recommended resources
    for res_rec in (result.recommended_resources or []):
        res_obj = resources_by_id.get(res_rec.resource_id)
        if not res_obj:
            continue  # Gemini hallucinated an ID — skip

        # For external URLs open directly; for internal resources link to /resources
        if res_obj.content_or_url and res_obj.content_or_url.startswith("http"):
            redirect_link = res_obj.content_or_url
        else:
            redirect_link = "/resources"

        recommendation = Recommendation(
            user_id=user_id,
            resource_id=res_obj.id,
            batch_id=batch_id,
            reason=encrypt_text(f"[resource] {res_rec.reason}"),
            redirect_link=redirect_link,
            status=RecommendationStatus.PENDING,
        )
        db.add(recommendation)

    # Store the overall summary as a special recommendation row
    summary_rec = Recommendation(
        user_id=user_id,
        batch_id=batch_id,
        reason=encrypt_text(f"[SUMMARY] {result.overall_summary}"),
        status=RecommendationStatus.PENDING,
    )
    db.add(summary_rec)

    db.commit()

    total_recs = len(result.recommended_tasks) + len(result.recommended_resources or [])
    # Create an in-app notification for the user
    try:
        notif = Notification(
            user_id=user_id,
            type="recommendation",
            title=encrypt_text("New AI Recommendations Available"),
            message=encrypt_text(
                f"Based on your latest activity, we have generated {total_recs} personalised "
                "recommendations to support your progress. Tap to review them."
            ),
            link="/analysis?tab=recommendations",
        )
        db.add(notif)
        db.commit()
    except Exception:
        logger.exception("Failed to create recommendation notification for user %s", user_id)
        db.rollback()


# ---------------------------------------------------------------------------
# Public API: trigger recommendation refresh
# ---------------------------------------------------------------------------

def refresh_recommendations(user_id: int, db: Session) -> bool:
    """
    Main entry point. Gather data → analyse → persist.
    Returns True if recommendations were generated, False otherwise.
    Called from background tasks after any submission.
    """
    try:
        snapshot = _gather_user_snapshot(user_id, db)
        if snapshot is None:
            logger.info("No data for user %s — skipping recommendations.", user_id)
            return False

        # Fetch global resources once so we can pass them to Gemini and persist
        global_resources = db.query(Resource).filter(
            Resource.patient_id.is_(None)
        ).all()

        result = _analyse_with_gemini(snapshot, global_resources)
        if result is None:
            return False

        _persist_recommendations(user_id, result, db)
        logger.info("Recommendations refreshed for user %s", user_id)
        return True
    except Exception:
        logger.exception("Failed to refresh recommendations for user %s", user_id)
        db.rollback()
        return False


# ---------------------------------------------------------------------------
# Public API: check task submission against recommendations
# ---------------------------------------------------------------------------

_LEVEL_MAP_REVERSE = {1: "low", 2: "medium", 3: "high"}


def trigger_batch_complete_check(user_id: int, db: Session) -> bool:
    """
    Check whether all actionable recs in the user's latest AI batch are
    COMPLETED or DISMISSED.  If so, trigger a fresh Gemini analysis.

    Returns True if a new analysis was triggered.
    Called as a background task from dismiss/complete PATCH endpoints.
    """
    latest = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == user_id,
            Recommendation.batch_id.isnot(None),
        )
        .order_by(desc(Recommendation.created_at))
        .first()
    )
    if not latest:
        return False

    batch_recs = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == user_id,
            Recommendation.batch_id == latest.batch_id,
        )
        .all()
    )

    actionable = []
    for r in batch_recs:
        decrypted = decrypt_text(r.reason) if r.reason else ""
        if decrypted.startswith("[SUMMARY]"):
            continue
        actionable.append(r)

    if not actionable:
        return False

    still_pending = any(r.status == RecommendationStatus.PENDING for r in actionable)
    if still_pending:
        return False

    logger.info(
        "Batch %s complete for user %s (via dismiss/complete) — triggering new analysis.",
        latest.batch_id, user_id,
    )
    return refresh_recommendations(user_id, db)


def check_and_update_recommendations(
    user_id: int,
    task_category: str,
    difficulty_level: int,
    db: Session,
) -> Dict[str, Any]:
    """
    Called after a task submission.  Checks whether the submitted task matches
    any PENDING recommendation in the user's latest batch.

    If matched → mark it COMPLETED.
    If the entire batch is now finished (all COMPLETED/DISMISSED) → trigger
    a new Gemini analysis so the user gets fresh recommendations.

    Returns a status dict for the API response.
    """
    result: Dict[str, Any] = {
        "matched": False,
        "recommendation_id": None,
        "batch_complete": False,
        "new_analysis_triggered": False,
    }

    # Find the user's latest batch_id (most recent non-null)
    latest_batch_rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == user_id,
            Recommendation.batch_id.isnot(None),
        )
        .order_by(desc(Recommendation.created_at))
        .first()
    )
    if not latest_batch_rec:
        return result

    batch_id = latest_batch_rec.batch_id

    # Get all recs in this batch (excluding [SUMMARY] rows)
    batch_recs = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == user_id,
            Recommendation.batch_id == batch_id,
        )
        .all()
    )

    # Separate summary from actionable recs
    actionable = []
    for r in batch_recs:
        decrypted = decrypt_text(r.reason) if r.reason else ""
        if decrypted.startswith("[SUMMARY]"):
            continue
        actionable.append((r, decrypted))

    # Try to match submitted task to a pending recommendation
    for rec, decrypted_reason in actionable:
        if rec.status != RecommendationStatus.PENDING:
            continue

        # Extract category from reason format: "[category] reason text"
        cat_match = decrypted_reason.split("]")[0].replace("[", "").strip() if "]" in decrypted_reason else None
        if not cat_match:
            continue

        # Match category
        if cat_match.lower() != task_category.lower():
            continue

        # Match difficulty level from redirect_link if present
        if rec.redirect_link and f"level=" in rec.redirect_link:
            try:
                rec_level = int(rec.redirect_link.split("level=")[1].split("&")[0])
            except (ValueError, IndexError):
                rec_level = None
        else:
            rec_level = None

        # Match: same category, and either no level specified or levels match
        if rec_level is None or rec_level == difficulty_level:
            rec.status = RecommendationStatus.COMPLETED
            db.commit()
            result["matched"] = True
            result["recommendation_id"] = rec.id
            break

    # Check if all actionable recs in the batch are now COMPLETED or DISMISSED
    still_pending = any(
        r.status == RecommendationStatus.PENDING
        for r, _ in actionable
    )

    if not still_pending and len(actionable) > 0:
        result["batch_complete"] = True
        logger.info("Batch %s complete for user %s — triggering new analysis.", batch_id, user_id)
        new_analysis = refresh_recommendations(user_id, db)
        result["new_analysis_triggered"] = new_analysis

    return result
