"""Add redirect_link column to recommendations table

Revision ID: 004_recommendation_redirect_link
Revises: 003_widen_encrypted_columns
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '004_recommendation_redirect_link'
down_revision = '003_widen_encrypted_columns'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'recommendations',
        sa.Column('redirect_link', sa.Text(), nullable=True)
    )


def downgrade():
    op.drop_column('recommendations', 'redirect_link')
