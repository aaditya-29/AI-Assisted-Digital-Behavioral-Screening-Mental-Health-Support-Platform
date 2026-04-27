"""
Journal Analysis Service

Uses Gemini structured-output mode to score each journal entry across 6
ASD-relevant behavioural attributes.

Structured output (response_mime_type="application/json" + response_schema)
forces Gemini to emit a complete, schema-valid JSON object every time —
no regex scraping, no truncation, no markdown fence issues.

Attribute rubric (0.0 – 1.0):
  mood_valence        : 0 = deeply distressed, 1 = content/happy
  anxiety_level       : 0 = none, 1 = overwhelming/panic
  social_engagement   : 0 = complete withdrawal, 1 = actively positive
  sensory_sensitivity : 0 = none mentioned, 1 = severe sensory distress
  emotional_regulation: 0 = severe dysregulation/meltdowns, 1 = well-regulated
  repetitive_behavior : 0 = none, 1 = pervasive fixations/routines
"""

import logging
from typing import Annotated, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, field_validator

from app.config import settings

logger = logging.getLogger(__name__)

_MODEL_NAME = "gemini-2.5-flash"
_SCHEMA_VERSION = "gemini-2.5-flash-structured-v1"

# ---------------------------------------------------------------------------
# Pydantic schema — passed to Gemini as response_schema so the model is
# constrained to produce exactly this structure.
# ---------------------------------------------------------------------------

Score = Annotated[float, Field(ge=0.0, le=1.0)]


class JournalAnalysisResult(BaseModel):
    mood_valence: Score
    anxiety_level: Score
    social_engagement: Score
    sensory_sensitivity: Score
    emotional_regulation: Score
    repetitive_behavior: Score
    reasoning: str = Field(
        ...,
        description="Short plain-English explanation (max 60 words) of the most significant signals detected.",
    )

    @field_validator(
        "mood_valence", "anxiety_level", "social_engagement",
        "sensory_sensitivity", "emotional_regulation", "repetitive_behavior",
        mode="before",
    )
    @classmethod
    def clamp_score(cls, v: float) -> float:
        return round(max(0.0, min(1.0, float(v))), 4)


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a clinical-psychology assistant helping analyse journal entries "
    "written by individuals who may have Autism Spectrum Disorder (ASD). "
    "Score the entry across the six behavioural attributes defined in the "
    "rubric. Scores must be floats in [0.0, 1.0]. If the text contains no "
    "evidence for an attribute, return 0.0 for it. "
    "IMPORTANT: Keep 'reasoning' to AT MOST 60 words and ONE sentence only. "
    "Do not exceed this limit under any circumstances."
)

_USER_PROMPT_TEMPLATE = """\
Score the following journal entry using this rubric:

  mood_valence        : 0 = deeply distressed, 1 = content/happy
  anxiety_level       : 0 = none, 1 = overwhelming/panic
  social_engagement   : 0 = complete withdrawal, 1 = actively positive
  sensory_sensitivity : 0 = none mentioned, 1 = severe sensory distress
  emotional_regulation: 0 = severe dysregulation/meltdowns, 1 = well-regulated
  repetitive_behavior : 0 = none, 1 = pervasive fixations/routines

--- JOURNAL ENTRY ---
{journal_text}
"""


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class JournalAnalysisService:
    """
    Thin synchronous wrapper around Gemini's structured-output API.

    Uses response_schema=JournalAnalysisResult so Gemini is constrained by
    the model's grammar to emit exactly the expected JSON — no parsing
    heuristics required.

    Called from FastAPI BackgroundTasks (thread pool), so synchronous is fine.
    """

    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set — journal analysis disabled.")
            self._client = None
            return
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def analyse(self, journal_text: str) -> Optional[dict]:
        """
        Return a dict with the 6 scored attributes, reasoning, and
        model_version, or None on any failure (logged, never raised).
        """
        if self._client is None:
            return None
        if not journal_text or not journal_text.strip():
            return None

        prompt = _USER_PROMPT_TEMPLATE.format(journal_text=journal_text.strip())

        try:
            response = self._client.models.generate_content(
                model=_MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=_SYSTEM_PROMPT,
                    # Structured output: Gemini is constrained to emit valid JSON
                    # matching JournalAnalysisResult — no truncation, no fences.
                    response_mime_type="application/json",
                    response_schema=JournalAnalysisResult,
                    temperature=0.2,
                    max_output_tokens=1024,
                    # Disable thinking: this is a simple classification task;
                    # thinking tokens were consuming the entire budget (512),
                    # leaving only a few tokens for actual JSON output.
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
        except Exception:
            logger.exception("Gemini API call failed for journal analysis.")
            return None

        try:
            result = JournalAnalysisResult.model_validate_json(response.text)
        except Exception:
            logger.exception(
                "Gemini structured output failed Pydantic validation: %s",
                (response.text or "")[:300],
            )
            return None

        return {
            "mood_valence": result.mood_valence,
            "anxiety_level": result.anxiety_level,
            "social_engagement": result.social_engagement,
            "sensory_sensitivity": result.sensory_sensitivity,
            "emotional_regulation": result.emotional_regulation,
            "repetitive_behavior": result.repetitive_behavior,
            "reasoning": result.reasoning[:500],
            "model_version": _SCHEMA_VERSION,
        }


# Module-level singleton — instantiated once at import time.
journal_analysis_service = JournalAnalysisService()
