from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)


class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


# =============================================================================
# Consent Schemas
# =============================================================================

class ConsentLogCreate(BaseModel):
    """Request to record user consent."""
    consent_type: str = Field(..., min_length=1, max_length=100)
    consented: bool
    ip_address: Optional[str] = Field(None, max_length=45)


class ConsentLogResponse(BaseModel):
    """Consent log response."""
    id: int
    user_id: int
    consent_type: str
    consented: bool
    ip_address: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
