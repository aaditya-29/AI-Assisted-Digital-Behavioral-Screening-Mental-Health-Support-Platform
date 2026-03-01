"""
Screening Service

Business logic for AQ-10 screening questionnaire, scoring, and risk assessment.
"""
from typing import List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.screening import (
    ScreeningSession, 
    ScreeningResponse, 
    Question, 
    Option,
    RiskLevel
)
from app.repositories.screening_repository import (
    ScreeningSessionRepository,
    ScreeningResponseRepository,
    QuestionRepository,
    OptionRepository
)
from app.utils.logging import get_logger

logger = get_logger(__name__)


# =============================================================================
# Risk Level Configuration
# =============================================================================

RISK_LEVEL_CONFIG = {
    RiskLevel.LOW: {
        "min_score": 0,
        "max_score": 2,
        "description": "Your responses suggest a low likelihood of autism spectrum traits. "
                      "This screening tool is not diagnostic.",
        "recommendations": [
            "Continue monitoring if you have concerns",
            "Explore our resources for general mental wellness",
            "No immediate action required based on this screening"
        ]
    },
    RiskLevel.MODERATE: {
        "min_score": 3,
        "max_score": 5,
        "description": "Your responses suggest some autism spectrum traits may be present. "
                      "Consider seeking a professional evaluation for a comprehensive assessment.",
        "recommendations": [
            "Consider scheduling an appointment with a healthcare professional",
            "Review our resources on autism spectrum characteristics",
            "Keep a journal of specific situations that concern you",
            "Discuss results with a trusted person"
        ]
    },
    RiskLevel.HIGH: {
        "min_score": 6,
        "max_score": 10,
        "description": "Your responses suggest a higher likelihood of autism spectrum traits. "
                      "We strongly recommend seeking a professional evaluation.",
        "recommendations": [
            "Schedule an appointment with a specialist (psychologist or psychiatrist)",
            "Bring these screening results to your appointment",
            "Explore our professional support resources",
            "Consider connecting with autism support communities",
            "Remember: This is a screening tool, not a diagnosis"
        ]
    }
}

AQ10_MAX_SCORE = 10


# =============================================================================
# Scoring Functions
# =============================================================================

def calculate_risk_level(raw_score: int) -> RiskLevel:
    """
    Determine risk level based on raw AQ-10 score.
    
    AQ-10 Scoring:
    - 0-2: Low likelihood
    - 3-5: Moderate likelihood (referral suggested)
    - 6-10: High likelihood (referral strongly suggested)
    """
    if raw_score <= 2:
        return RiskLevel.LOW
    elif raw_score <= 5:
        return RiskLevel.MODERATE
    else:
        return RiskLevel.HIGH


def get_risk_description(risk_level: RiskLevel) -> str:
    """Get the description for a risk level."""
    return RISK_LEVEL_CONFIG[risk_level]["description"]


def get_risk_recommendations(risk_level: RiskLevel) -> List[str]:
    """Get recommendations for a risk level."""
    return RISK_LEVEL_CONFIG[risk_level]["recommendations"]


# =============================================================================
# Screening Service Class
# =============================================================================

class ScreeningService:
    """Service for managing AQ-10 screening sessions."""
    
    def __init__(self, db: Session):
        self.db = db
        self.session_repo = ScreeningSessionRepository(db)
        self.response_repo = ScreeningResponseRepository(db)
        self.question_repo = QuestionRepository(db)
        self.option_repo = OptionRepository(db)
    
    def get_all_questions(self) -> List[Question]:
        """Get all AQ-10 questions with their options."""
        questions = self.question_repo.get_all_with_options()
        # Ensure options are loaded
        for question in questions:
            _ = question.options  # Force load
        return questions
    
    def start_screening(self, user_id: int) -> Tuple[ScreeningSession, List[Question]]:
        """
        Start a new screening session for a user.
        
        Returns the session and questions to display.
        """
        # Check for incomplete session
        incomplete = self.db.query(ScreeningSession).filter(
            ScreeningSession.user_id == user_id,
            ScreeningSession.completed_at.is_(None)
        ).first()
        
        if incomplete:
            # Return existing incomplete session
            logger.info(f"Resuming incomplete screening session {incomplete.id} for user {user_id}")
            questions = self.get_all_questions()
            return incomplete, questions
        
        # Create new session
        session = ScreeningSession(user_id=user_id)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        logger.info(f"Started new screening session {session.id} for user {user_id}")
        
        questions = self.get_all_questions()
        return session, questions
    
    def submit_answer(
        self, 
        session_id: int, 
        question_id: int, 
        option_id: int,
        response_time_ms: Optional[int] = None
    ) -> ScreeningResponse:
        """Submit a single answer to a question."""
        # Validate session exists and is not complete
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise ValueError("Screening session not found")
        if session.completed_at:
            raise ValueError("Screening session is already complete")
        
        # Validate option belongs to question
        option = self.db.query(Option).filter(
            Option.id == option_id,
            Option.question_id == question_id
        ).first()
        if not option:
            raise ValueError("Invalid option for this question")
        
        # Check if already answered
        existing = self.db.query(ScreeningResponse).filter(
            ScreeningResponse.screening_id == session_id,
            ScreeningResponse.question_id == question_id
        ).first()
        
        if existing:
            # Update existing response
            existing.selected_option_id = option_id
            existing.response_time_ms = response_time_ms
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        # Create new response
        response = ScreeningResponse(
            screening_id=session_id,
            question_id=question_id,
            selected_option_id=option_id,
            response_time_ms=response_time_ms
        )
        self.db.add(response)
        self.db.commit()
        self.db.refresh(response)
        
        return response
    
    def submit_all_answers(
        self,
        session_id: int,
        answers: List[dict]
    ) -> ScreeningSession:
        """
        Submit all answers at once and complete the screening.
        
        Args:
            session_id: The screening session ID
            answers: List of {question_id, selected_option_id, response_time_ms}
        
        Returns:
            Completed screening session with results
        """
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise ValueError("Screening session not found")
        if session.completed_at:
            raise ValueError("Screening session is already complete")
        
        # Submit each answer
        for answer in answers:
            self.submit_answer(
                session_id=session_id,
                question_id=answer["question_id"],
                option_id=answer["selected_option_id"],
                response_time_ms=answer.get("response_time_ms")
            )
        
        # Complete the screening
        return self.complete_screening(session_id)
    
    def complete_screening(self, session_id: int) -> ScreeningSession:
        """
        Complete a screening session and calculate results.
        
        Calculates raw score, risk level, and optionally ML risk score.
        """
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise ValueError("Screening session not found")
        if session.completed_at:
            raise ValueError("Screening session is already complete")
        
        # Get all responses
        responses = self.response_repo.get_by_screening_id(session_id)
        
        # Verify all questions answered
        questions = self.get_all_questions()
        if len(responses) < len(questions):
            raise ValueError(
                f"Incomplete screening: {len(responses)}/{len(questions)} questions answered"
            )
        
        # Calculate raw score
        raw_score = 0
        for response in responses:
            option = self.db.query(Option).filter(Option.id == response.selected_option_id).first()
            if option:
                raw_score += option.score_value
        
        # Determine risk level
        risk_level = calculate_risk_level(raw_score)
        
        # Update session
        session.completed_at = datetime.utcnow()
        session.raw_score = raw_score
        session.risk_level = risk_level
        
        # TODO: Add ML risk score calculation here
        # session.ml_risk_score = ml_service.predict_risk(responses)
        # session.model_version = ml_service.get_model_version()
        
        self.db.commit()
        self.db.refresh(session)
        
        logger.info(
            f"Completed screening session {session_id}: "
            f"score={raw_score}, risk_level={risk_level.value}"
        )
        
        return session
    
    def get_session_with_responses(self, session_id: int) -> Tuple[ScreeningSession, List[dict]]:
        """
        Get a screening session with detailed response information.
        """
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise ValueError("Screening session not found")
        
        responses = self.response_repo.get_by_screening_id(session_id)
        
        detailed_responses = []
        for response in responses:
            question = self.db.query(Question).filter(Question.id == response.question_id).first()
            option = self.db.query(Option).filter(Option.id == response.selected_option_id).first()
            
            detailed_responses.append({
                "question_id": question.id,
                "question_text": question.text,
                "selected_option_id": option.id,
                "selected_option_text": option.text,
                "score_value": option.score_value,
                "response_time_ms": response.response_time_ms
            })
        
        return session, detailed_responses
    
    def get_user_history(self, user_id: int, limit: int = 10) -> List[ScreeningSession]:
        """Get a user's screening history."""
        return self.db.query(ScreeningSession).filter(
            ScreeningSession.user_id == user_id
        ).order_by(ScreeningSession.started_at.desc()).limit(limit).all()
    
    def get_latest_completed(self, user_id: int) -> Optional[ScreeningSession]:
        """Get the user's most recent completed screening."""
        return self.session_repo.get_latest_by_user(user_id)
    
    def delete_incomplete_session(self, session_id: int, user_id: int) -> bool:
        """Delete an incomplete screening session."""
        session = self.db.query(ScreeningSession).filter(
            ScreeningSession.id == session_id,
            ScreeningSession.user_id == user_id,
            ScreeningSession.completed_at.is_(None)
        ).first()
        
        if session:
            self.db.delete(session)
            self.db.commit()
            return True
        return False


# =============================================================================
# Utility Functions
# =============================================================================

def get_risk_levels_info() -> List[dict]:
    """Get information about all risk levels."""
    return [
        {
            "level": level.value,
            "score_range": f"{config['min_score']}-{config['max_score']}",
            "description": config["description"],
            "recommendations": config["recommendations"]
        }
        for level, config in RISK_LEVEL_CONFIG.items()
    ]
