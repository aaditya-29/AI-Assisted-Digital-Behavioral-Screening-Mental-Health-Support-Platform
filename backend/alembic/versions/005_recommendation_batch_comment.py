"""Add batch_id and comment columns to recommendations

Revision ID: 005_recommendation_batch_comment
Revises: 004_recommendation_redirect_link
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = '005_recommendation_batch_comment'
down_revision = '004_recommendation_redirect_link'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'recommendations',
        sa.Column('batch_id', sa.String(36), nullable=True, index=True)
    )
    op.add_column(
        'recommendations',
        sa.Column('comment', sa.Text(), nullable=True)
    )


def downgrade():
    op.drop_column('recommendations', 'comment')
    op.drop_column('recommendations', 'batch_id')
