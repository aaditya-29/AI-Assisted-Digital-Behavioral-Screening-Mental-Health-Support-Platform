"""Widen columns to accommodate Fernet encrypted values

Revision ID: 003_widen_encrypted_columns
Revises: 002_journal_analysis_asd
Create Date: 2026-04-27

Fernet tokens are longer than plaintext. This widens columns that now
store encrypted data.
"""
from alembic import op
import sqlalchemy as sa

revision = "003_widen_encrypted_columns"
down_revision = "002_journal_analysis_asd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # consent_logs.ip_address: String(45) -> String(500)
    op.alter_column(
        "consent_logs", "ip_address",
        existing_type=sa.String(45),
        type_=sa.String(500),
        existing_nullable=True,
    )
    # professional_profiles.license_number: String(100) -> String(500)
    op.alter_column(
        "professional_profiles", "license_number",
        existing_type=sa.String(100),
        type_=sa.String(500),
        existing_nullable=False,
    )
    # notifications.title: String(255) -> String(500)
    op.alter_column(
        "notifications", "title",
        existing_type=sa.String(255),
        type_=sa.String(500),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "notifications", "title",
        existing_type=sa.String(500),
        type_=sa.String(255),
        existing_nullable=False,
    )
    op.alter_column(
        "professional_profiles", "license_number",
        existing_type=sa.String(500),
        type_=sa.String(100),
        existing_nullable=False,
    )
    op.alter_column(
        "consent_logs", "ip_address",
        existing_type=sa.String(500),
        type_=sa.String(45),
        existing_nullable=True,
    )
