"""add ml prediction and question scores columns

Revision ID: 001_ml_fields
Revises: 
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '001_ml_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add ml_prediction, ml_probability_label, question_scores to screening_sessions
    op.add_column('screening_sessions',
        sa.Column('ml_prediction', sa.Integer(), nullable=True)
    )
    op.add_column('screening_sessions',
        sa.Column('ml_probability_label', sa.String(20), nullable=True)
    )
    op.add_column('screening_sessions',
        sa.Column('question_scores', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('screening_sessions', 'question_scores')
    op.drop_column('screening_sessions', 'ml_probability_label')
    op.drop_column('screening_sessions', 'ml_prediction')
