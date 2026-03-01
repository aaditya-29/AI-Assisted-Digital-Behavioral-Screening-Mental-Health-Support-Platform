#!/usr/bin/env python
"""
Seed example tasks into the database.
Run this after the database is initialized.

Usage: python seed_tasks.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.task import Task
from app.utils.logging import get_logger

logger = get_logger(__name__)


TASKS = [
    {
        "name": "Memory Match",
        "type": "cognitive",
        "description": "Pair matching memory task to assess working memory and attention."
    },
    {
        "name": "Reaction Time",
        "type": "sensorimotor",
        "description": "Simple reaction-time task measuring response latency to visual stimuli."
    },
    {
        "name": "Pattern Recognition",
        "type": "cognitive",
        "description": "Identify completion of visual patterns under time constraints."
    },
    {
        "name": "Trail Making",
        "type": "executive",
        "description": "Connect-the-dots style task measuring cognitive flexibility and processing speed."
    }
]


def seed_tasks():
    db = SessionLocal()

    try:
        existing = db.query(Task).count()
        if existing > 0:
            logger.warning(f"Tasks already seeded ({existing} found). Skipping seed.")
            print(f"✓ Tasks already exist ({existing}). Skipping.")
            return existing

        for t in TASKS:
            task = Task(
                name=t["name"],
                type=t.get("type"),
                description=t.get("description")
            )
            db.add(task)

        db.commit()
        logger.info(f"Seeded {len(TASKS)} tasks")
        print(f"✓ Successfully seeded {len(TASKS)} tasks!")
        return len(TASKS)

    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding tasks: {str(e)}")
        print(f"✗ Error seeding tasks: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Starting task seed...")
    seed_tasks()
    print("Done!")
