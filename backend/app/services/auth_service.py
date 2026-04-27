from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User
from app.models.professional import ProfessionalProfile
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import get_password_hash, verify_password
from app.utils.logging import get_logger
from app.utils.crypto import encrypt_text, decrypt_text

logger = get_logger(__name__)


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_data: UserCreate) -> User:
    password_hash = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        password_hash=password_hash,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        date_of_birth=user_data.date_of_birth
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # If registering as professional applicant, create a pending profile
    if user_data.is_professional_applicant and user_data.license_number:
        profile = ProfessionalProfile(
            user_id=db_user.id,
            license_number=encrypt_text(user_data.license_number),
            specialty=user_data.specialty or "",
            institution=user_data.institution,
            is_verified=False
        )
        db.add(profile)
        db.commit()
        logger.info(f"Professional profile created (pending) for: {db_user.email}")

    logger.info(f"New user created: {db_user.email}")
    return db_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def update_user(db: Session, user: User, user_data: UserUpdate) -> User:
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, new_password: str) -> User:
    user.password_hash = get_password_hash(new_password)
    db.commit()
    db.refresh(user)
    logger.info(f"Password changed for user: {user.email}")
    return user


def deactivate_user(db: Session, user: User) -> User:
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user
