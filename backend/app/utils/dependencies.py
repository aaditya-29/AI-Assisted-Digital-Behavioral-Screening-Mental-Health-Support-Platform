"""
Role-based Access Control (RBAC) Dependencies

This module provides FastAPI dependencies for authentication and authorization.
Supports three roles: USER, PROFESSIONAL, ADMIN with hierarchical permissions.
"""
from typing import List, Callable
from functools import wraps
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.utils.security import decode_token

security = HTTPBearer()


# =============================================================================
# Base Authentication Dependencies
# =============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validate JWT token and return the current user.
    Raises 401 if token is invalid or user not found.
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Alias for get_current_user - ensures user is active."""
    return current_user


# =============================================================================
# Role-based Access Control Dependencies
# =============================================================================

class RoleChecker:
    """
    Dependency class for checking user roles.
    
    Usage:
        @router.get("/admin-only")
        def admin_route(user: User = Depends(RoleChecker([UserRole.ADMIN]))):
            ...
    """
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles
    
    async def __call__(
        self, 
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in self.allowed_roles]}"
            )
        return current_user


# Pre-configured role checkers for common use cases
require_admin = RoleChecker([UserRole.ADMIN])
require_professional = RoleChecker([UserRole.PROFESSIONAL, UserRole.ADMIN])
require_user = RoleChecker([UserRole.USER, UserRole.PROFESSIONAL, UserRole.ADMIN])


# =============================================================================
# Specific Role Dependencies (Alternative Approach)
# =============================================================================

async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency that requires ADMIN role.
    
    Usage:
        @router.delete("/users/{user_id}")
        def delete_user(user_id: int, admin: User = Depends(get_admin_user)):
            ...
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_professional_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency that requires PROFESSIONAL or ADMIN role.
    Professionals can view shared patient data.
    
    Usage:
        @router.get("/patients/{patient_id}/analysis")
        def view_patient(patient_id: int, professional: User = Depends(get_professional_user)):
            ...
    """
    if current_user.role not in [UserRole.PROFESSIONAL, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Professional access required"
        )
    return current_user


async def get_standard_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency for standard authenticated users (any role).
    This is the default for most user-facing routes.
    """
    return current_user


# =============================================================================
# Resource Ownership Verification
# =============================================================================

def verify_resource_ownership(
    resource_user_id: int,
    current_user: User,
    allow_admin: bool = True,
    allow_professional: bool = False
) -> bool:
    """
    Verify that a user owns a resource or has elevated permissions.
    
    Args:
        resource_user_id: The user_id that owns the resource
        current_user: The authenticated user making the request
        allow_admin: If True, admins can access any resource
        allow_professional: If True, professionals can access shared resources
    
    Returns:
        True if access is allowed
    
    Raises:
        HTTPException 403 if access denied
    """
    # User owns the resource
    if current_user.id == resource_user_id:
        return True
    
    # Admin override
    if allow_admin and current_user.role == UserRole.ADMIN:
        return True
    
    # Professional access (for shared data)
    if allow_professional and current_user.role == UserRole.PROFESSIONAL:
        return True
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have permission to access this resource"
    )


# =============================================================================
# Permission Constants
# =============================================================================

class Permissions:
    """
    Permission constants for fine-grained access control.
    Can be extended for more granular permissions in the future.
    """
    # User permissions
    VIEW_OWN_DATA = "view_own_data"
    EDIT_OWN_DATA = "edit_own_data"
    DELETE_OWN_DATA = "delete_own_data"
    TAKE_SCREENING = "take_screening"
    VIEW_OWN_RESULTS = "view_own_results"
    SHARE_WITH_PROFESSIONAL = "share_with_professional"
    
    # Professional permissions
    VIEW_SHARED_DATA = "view_shared_data"
    ADD_PROFESSIONAL_NOTES = "add_professional_notes"
    
    # Admin permissions
    VIEW_ALL_USERS = "view_all_users"
    EDIT_ALL_USERS = "edit_all_users"
    DELETE_USERS = "delete_users"
    VIEW_SYSTEM_STATS = "view_system_stats"
    MANAGE_RESOURCES = "manage_resources"


# Role to permissions mapping
ROLE_PERMISSIONS = {
    UserRole.USER: [
        Permissions.VIEW_OWN_DATA,
        Permissions.EDIT_OWN_DATA,
        Permissions.DELETE_OWN_DATA,
        Permissions.TAKE_SCREENING,
        Permissions.VIEW_OWN_RESULTS,
        Permissions.SHARE_WITH_PROFESSIONAL,
    ],
    UserRole.PROFESSIONAL: [
        Permissions.VIEW_OWN_DATA,
        Permissions.EDIT_OWN_DATA,
        Permissions.DELETE_OWN_DATA,
        Permissions.TAKE_SCREENING,
        Permissions.VIEW_OWN_RESULTS,
        Permissions.SHARE_WITH_PROFESSIONAL,
        Permissions.VIEW_SHARED_DATA,
        Permissions.ADD_PROFESSIONAL_NOTES,
    ],
    UserRole.ADMIN: [
        Permissions.VIEW_OWN_DATA,
        Permissions.EDIT_OWN_DATA,
        Permissions.DELETE_OWN_DATA,
        Permissions.TAKE_SCREENING,
        Permissions.VIEW_OWN_RESULTS,
        Permissions.SHARE_WITH_PROFESSIONAL,
        Permissions.VIEW_SHARED_DATA,
        Permissions.ADD_PROFESSIONAL_NOTES,
        Permissions.VIEW_ALL_USERS,
        Permissions.EDIT_ALL_USERS,
        Permissions.DELETE_USERS,
        Permissions.VIEW_SYSTEM_STATS,
        Permissions.MANAGE_RESOURCES,
    ],
}


def has_permission(user: User, permission: str) -> bool:
    """Check if a user has a specific permission."""
    user_permissions = ROLE_PERMISSIONS.get(user.role, [])
    return permission in user_permissions


class PermissionChecker:
    """
    Dependency for checking specific permissions.
    
    Usage:
        @router.get("/system/stats")
        def get_stats(user: User = Depends(PermissionChecker(Permissions.VIEW_SYSTEM_STATS))):
            ...
    """
    def __init__(self, required_permission: str):
        self.required_permission = required_permission
    
    async def __call__(
        self, 
        current_user: User = Depends(get_current_user)
    ) -> User:
        if not has_permission(current_user, self.required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {self.required_permission}"
            )
        return current_user
