#!/usr/bin/env python
"""
Create the first admin user for the system.
Run this after the database is initialized.

Usage: python seed_admin.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.utils.security import get_password_hash
from app.utils.logging import get_logger

logger = get_logger(__name__)


def create_admin():
    """Create the first admin user."""
    db = SessionLocal()
    
    try:
        # Check if any admin exists
        admin_exists = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if admin_exists:
            logger.warning("Admin user already exists!")
            print(f"✓ Admin user already exists: {admin_exists.email}")
            return admin_exists
        
        # Create admin user
        admin_user = User(
            email="admin@example.com",
            password_hash=get_password_hash("AdminPassword123"),
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        logger.info(f"Admin user created: {admin_user.email}")
        print(f"✓ Admin user created successfully!")
        print(f"  Email: {admin_user.email}")
        print(f"  Password: AdminPassword123")
        print(f"  ID: {admin_user.id}")
        print("\n⚠️  IMPORTANT:")
        print("  1. Change the password after first login!")
        print("  2. Do NOT share these credentials in production!")
        
        return admin_user
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating admin: {str(e)}")
        print(f"✗ Error creating admin: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Creating first admin user...")
    create_admin()
    print("Done!")
