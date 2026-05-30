from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class EmailVerification(Base):
    """
    Stores one-time OTP records for email verification.
    A new record is created each time an OTP is issued;
    old ones are invalidated (is_used=True or expired).
    """
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # SHA-256 hex digest of the 6-digit OTP
    otp_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    # Number of failed verification attempts for this OTP
    attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship(
        "User",
        back_populates="email_verifications",
        passive_deletes=True,
    )
