"""Rebuild journal_analyses table with ASD behavioural attributes

Revision ID: 002_journal_analysis_asd
Revises: 001_ml_fields
Create Date: 2026-04-26

Normalises the journal_analyses table to the canonical 6 ASD-specific
float attributes plus raw_reasoning.  Handles partial previous migrations
gracefully.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "002_journal_analysis_asd"
down_revision = "001_ml_fields"
branch_labels = None
depends_on = None


def _existing_columns():
    bind = op.get_bind()
    insp = inspect(bind)
    return {c["name"] for c in insp.get_columns("journal_analyses")}


def upgrade() -> None:
    existing = _existing_columns()

    for col in ("sentiment_score", "emotion_label", "mood", "routine_disruption"):
        if col in existing:
            op.drop_column("journal_analyses", col)

    desired_floats = [
        "mood_valence", "anxiety_level", "social_engagement",
        "sensory_sensitivity", "emotional_regulation", "repetitive_behavior",
    ]
    for col in desired_floats:
        if col not in existing:
            op.add_column("journal_analyses", sa.Column(col, sa.Float(), nullable=True))

    if "raw_reasoning" not in existing:
        op.add_column("journal_analyses", sa.Column("raw_reasoning", sa.Text(), nullable=True))


def downgrade() -> None:
    existing = _existing_columns()

    if "raw_reasoning" in existing:
        op.drop_column("journal_analyses", "raw_reasoning")
    for col in ("repetitive_behavior", "emotional_regulation", "sensory_sensitivity",
                "social_engagement", "anxiety_level", "mood_valence"):
        if col in existing:
            op.drop_column("journal_analyses", col)

    op.add_column("journal_analyses", sa.Column("emotion_label", sa.String(100), nullable=True))
    op.add_column("journal_analyses", sa.Column("sentiment_score", sa.Float(), nullable=True))
