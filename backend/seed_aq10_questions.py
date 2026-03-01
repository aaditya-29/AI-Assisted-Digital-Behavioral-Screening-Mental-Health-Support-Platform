#!/usr/bin/env python
"""
Seed AQ-10 screening questions and options into the database.
Run this after initializing the database.

Usage: python seed_aq10_questions.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.screening import Question, Option
from app.utils.logging import get_logger

logger = get_logger(__name__)

# AQ-10 Questions and scoring
AQ10_QUESTIONS = [
    {
        "id": 1,
        "text": "I prefer to do things with others rather than on my own.",
        "category": "social_communication",
        "options": [
            {"text": "Definitely agree", "score": 0},
            {"text": "Slightly agree", "score": 0},
            {"text": "Slightly disagree", "score": 1},
            {"text": "Definitely disagree", "score": 1}
        ]
    },
    {
        "id": 2,
        "text": "I prefer to do things the same way over and over again.",
        "category": "restricted_repetitive",
        "options": [
            {"text": "Definitely agree", "score": 1},
            {"text": "Slightly agree", "score": 1},
            {"text": "Slightly disagree", "score": 0},
            {"text": "Definitely disagree", "score": 0}
        ]
    },
    {
        "id": 3,
        "text": "If I try to imagine something, I find it very easy to create a picture in my mind.",
        "category": "attention_to_detail",
        "options": [
            {"text": "Definitely agree", "score": 0},
            {"text": "Slightly agree", "score": 0},
            {"text": "Slightly disagree", "score": 1},
            {"text": "Definitely disagree", "score": 1}
        ]
    },
    {
        "id": 4,
        "text": "I often notice small sounds when others do not.",
        "category": "sensory_processing",
        "options": [
            {"text": "Definitely agree", "score": 1},
            {"text": "Slightly agree", "score": 1},
            {"text": "Slightly disagree", "score": 0},
            {"text": "Definitely disagree", "score": 0}
        ]
    },
    {
        "id": 5,
        "text": "I usually notice car number plates or similar strings of information.",
        "category": "attention_to_detail",
        "options": [
            {"text": "Definitely agree", "score": 1},
            {"text": "Slightly agree", "score": 1},
            {"text": "Slightly disagree", "score": 0},
            {"text": "Definitely disagree", "score": 0}
        ]
    },
    {
        "id": 6,
        "text": "Other people frequently tell me that what I've said is impolite, even though I think it is polite.",
        "category": "social_communication",
        "options": [
            {"text": "Definitely agree", "score": 1},
            {"text": "Slightly agree", "score": 1},
            {"text": "Slightly disagree", "score": 0},
            {"text": "Definitely disagree", "score": 0}
        ]
    },
    {
        "id": 7,
        "text": "When I'm reading a story, I can easily imagine what the characters might look like.",
        "category": "attention_to_detail",
        "options": [
            {"text": "Definitely agree", "score": 0},
            {"text": "Slightly agree", "score": 0},
            {"text": "Slightly disagree", "score": 1},
            {"text": "Definitely disagree", "score": 1}
        ]
    },
    {
        "id": 8,
        "text": "I am fascinated by numbers or patterns.",
        "category": "restricted_repetitive",
        "options": [
            {"text": "Definitely agree", "score": 1},
            {"text": "Slightly agree", "score": 1},
            {"text": "Slightly disagree", "score": 0},
            {"text": "Definitely disagree", "score": 0}
        ]
    },
    {
        "id": 9,
        "text": "When I talk, it isn't always easy for me to know what someone else might want to talk about.",
        "category": "social_communication",
        "options": [
            {"text": "Definitely agree", "score": 1},
            {"text": "Slightly agree", "score": 1},
            {"text": "Slightly disagree", "score": 0},
            {"text": "Definitely disagree", "score": 0}
        ]
    },
    {
        "id": 10,
        "text": "I find it easy to 'read between the lines' when someone is talking to me.",
        "category": "social_communication",
        "options": [
            {"text": "Definitely agree", "score": 0},
            {"text": "Slightly agree", "score": 0},
            {"text": "Slightly disagree", "score": 1},
            {"text": "Definitely disagree", "score": 1}
        ]
    }
]


def seed_questions():
    """Insert AQ-10 questions into the database."""
    db = SessionLocal()
    
    try:
        # Check if questions already exist
        existing_count = db.query(Question).count()
        if existing_count > 0:
            logger.warning(f"Database already contains {existing_count} questions. Skipping seed.")
            print(f"✓ Questions already exist ({existing_count} found). Skipping seed.")
            return existing_count
        
        # Add each question with its options
        for q_data in AQ10_QUESTIONS:
            question = Question(
                text=q_data["text"],
                category=q_data["category"]
            )
            db.add(question)
            db.flush()  # Get the question ID
            
            # Add options for this question
            for opt_data in q_data["options"]:
                option = Option(
                    question_id=question.id,
                    text=opt_data["text"],
                    score_value=opt_data["score"]
                )
                db.add(option)
        
        db.commit()
        logger.info(f"Successfully seeded {len(AQ10_QUESTIONS)} AQ-10 questions")
        print(f"✓ Successfully seeded {len(AQ10_QUESTIONS)} AQ-10 questions!")
        return len(AQ10_QUESTIONS)
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding questions: {str(e)}")
        print(f"✗ Error seeding questions: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Starting AQ-10 question seed...")
    seed_questions()
    print("Done!")
