"""
Notification Routes

Endpoints for in-app notifications.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str | None = None
    is_read: bool
    link: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCounts(BaseModel):
    total_unread: int
    consultation_requests: int
    notes: int
    journals: int
    resources: int
    other: int


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the current user's notifications."""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(desc(Notification.created_at)).limit(limit).all()
    from app.utils.crypto import decrypt_text
    for n in notifications:
        n.title = decrypt_text(n.title) if n.title else n.title
        n.message = decrypt_text(n.message) if n.message else n.message
    return notifications


@router.get("/counts", response_model=NotificationCounts)
async def get_notification_counts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get unread notification counts by category."""
    unread = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).all()

    counts = {"consultation_requests": 0, "notes": 0, "journals": 0, "resources": 0, "other": 0}
    for n in unread:
        if n.type in ("consultation_request", "consultation_accepted", "consultation_declined"):
            counts["consultation_requests"] += 1
        elif n.type == "note_added":
            counts["notes"] += 1
        elif n.type == "journal_shared":
            counts["journals"] += 1
        elif n.type == "resource_assigned":
            counts["resources"] += 1
        else:
            counts["other"] += 1

    return NotificationCounts(total_unread=len(unread), **counts)


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.patch("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


# =============================================================================
# Helper function to create notifications (used by other routes)
# =============================================================================

def create_notification(db: Session, user_id: int, type: str, title: str, message: str = None, link: str = None):
    """Create an in-app notification for a user."""
    from app.utils.crypto import encrypt_text
    notif = Notification(
        user_id=user_id,
        type=type,
        title=encrypt_text(title) if title else title,
        message=encrypt_text(message) if message else message,
        link=link
    )
    db.add(notif)
    db.commit()
    return notif
