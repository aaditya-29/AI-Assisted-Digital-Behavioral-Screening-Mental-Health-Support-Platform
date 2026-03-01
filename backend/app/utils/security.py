from datetime import datetime, timedelta
from typing import Optional
import hashlib

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings


# Use bcrypt via passlib
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# ==============================
# Password Hashing Utilities
# ==============================

def get_password_hash(password: str) -> str:
    """
    Hash a password securely using bcrypt via passlib.
    Follows FastAPI best practices and is compatible with bcrypt==4.0.1.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash using bcrypt via passlib.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ==============================
# JWT Token Utilities
# ==============================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({
        "exp": expire,
        "type": "access"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )

    to_encode.update({
        "exp": expire,
        "type": "refresh"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None