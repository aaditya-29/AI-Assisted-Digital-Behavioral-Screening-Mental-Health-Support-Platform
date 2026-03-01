"""
Task Service

Business logic for behavioral tasks, session management, and performance tracking.
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.task import Task, TaskSession, TaskResult
from app.repositories.task_repository import (
    TaskRepository,
    TaskSessionRepository,
    TaskResultRepository
)
from app.utils.logging import get_logger

logger = get_logger(__name__)


# =============================================================================
# Task Configuration
# =============================================================================

# Task-specific configurations and instructions
TASK_CONFIG = {
    "attention": {
        "instructions": """
        Focus Task: Sustained Attention Test
        
        In this task, you will see a series of shapes appearing on the screen.
        Click or tap when you see a CIRCLE, but NOT when you see other shapes.
        
        Try to respond as quickly and accurately as possible.
        The task will last approximately 3 minutes.
        """,
        "estimated_duration": 180,
        "config": {
            "stimulus_duration_ms": 500,
            "inter_stimulus_interval_ms": 1500,
            "target_ratio": 0.3,
            "total_stimuli": 60,
            "shapes": ["circle", "square", "triangle"]
        },
        "metrics": ["accuracy", "reaction_time_avg", "commission_errors", "omission_errors"]
    },
    "memory": {
        "instructions": """
        Memory Task: Pattern Recall
        
        You will be shown a pattern of colored tiles.
        After the pattern disappears, recreate it by clicking the tiles in the same order.
        
        The patterns will become progressively longer as you succeed.
        """,
        "estimated_duration": 300,
        "config": {
            "grid_size": 4,
            "initial_sequence_length": 3,
            "max_sequence_length": 9,
            "display_time_ms": 500,
            "colors": ["red", "blue", "green", "yellow"]
        },
        "metrics": ["max_sequence", "accuracy", "total_correct", "total_attempts"]
    },
    "processing_speed": {
        "instructions": """
        Processing Speed Task: Symbol Matching
        
        You will see pairs of symbols. Indicate whether they are the SAME or DIFFERENT
        as quickly as possible.
        
        Accuracy is important, but try to maintain a quick pace.
        """,
        "estimated_duration": 120,
        "config": {
            "time_limit_seconds": 90,
            "symbols": ["★", "●", "■", "▲", "◆", "♦", "♠", "♣"],
            "match_probability": 0.5
        },
        "metrics": ["correct_responses", "incorrect_responses", "reaction_time_avg", "throughput"]
    },
    "flexibility": {
        "instructions": """
        Cognitive Flexibility Task: Rule Switching
        
        Sort cards based on changing rules (color, shape, or number).
        The rule will change without warning - adapt as quickly as you can.
        
        Pay attention to feedback to determine when the rule has changed.
        """,
        "estimated_duration": 240,
        "config": {
            "total_trials": 48,
            "rule_change_after": 8,
            "rules": ["color", "shape", "number"],
            "feedback_duration_ms": 500
        },
        "metrics": ["perseverative_errors", "total_correct", "categories_completed", "trials_to_first_category"]
    },
    "response_inhibition": {
        "instructions": """
        Response Inhibition Task: Go/No-Go
        
        Press the button when you see a GREEN circle (Go).
        Do NOT press when you see a RED circle (No-Go).
        
        Respond as quickly as possible while avoiding mistakes on red circles.
        """,
        "estimated_duration": 180,
        "config": {
            "go_ratio": 0.75,
            "stimulus_duration_ms": 300,
            "inter_stimulus_interval_ms": 1200,
            "total_trials": 80
        },
        "metrics": ["go_accuracy", "nogo_accuracy", "go_reaction_time", "false_alarms"]
    },
    "social_cognition": {
        "instructions": """
        Social Cognition Task: Emotion Recognition
        
        You will see faces showing different emotions.
        Select the emotion that best matches what the person is feeling.
        
        Take your time to consider each face carefully.
        """,
        "estimated_duration": 300,
        "config": {
            "total_faces": 24,
            "emotions": ["happy", "sad", "angry", "fearful", "surprised", "neutral"],
            "difficulty_levels": ["easy", "medium", "hard"]
        },
        "metrics": ["overall_accuracy", "emotion_accuracy", "reaction_time_avg", "confidence_rating"]
    }
}

DEFAULT_CONFIG = {
    "instructions": "Complete this behavioral task according to the on-screen prompts.",
    "estimated_duration": 180,
    "config": {},
    "metrics": ["score", "completion_time"]
}


# =============================================================================
# Task Service Class
# =============================================================================

class TaskService:
    """Service for managing behavioral tasks and sessions."""
    
    def __init__(self, db: Session):
        self.db = db
        self.task_repo = TaskRepository(db)
        self.session_repo = TaskSessionRepository(db)
        self.result_repo = TaskResultRepository(db)
    
    def get_all_tasks(self) -> List[Task]:
        """Get all available tasks."""
        return self.task_repo.get_all()
    
    def get_task_by_id(self, task_id: int) -> Optional[Task]:
        """Get a specific task by ID."""
        return self.task_repo.get_by_id(task_id)
    
    def get_tasks_by_type(self, task_type: str) -> List[Task]:
        """Get tasks filtered by type."""
        return self.task_repo.get_by_type(task_type)
    
    def get_task_config(self, task: Task) -> Dict[str, Any]:
        """Get task configuration based on task type."""
        task_type = task.type.lower() if task.type else "default"
        config = TASK_CONFIG.get(task_type, DEFAULT_CONFIG)
        return {
            "instructions": config["instructions"].strip(),
            "estimated_duration": config["estimated_duration"],
            "config": config["config"]
        }
    
    def start_session(self, user_id: int, task_id: int) -> Tuple[TaskSession, Dict[str, Any]]:
        """
        Start a new task session.
        
        Returns the session and task configuration.
        """
        task = self.get_task_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Check for incomplete session for this task
        incomplete = self.db.query(TaskSession).filter(
            TaskSession.user_id == user_id,
            TaskSession.task_id == task_id,
            TaskSession.completed_at.is_(None)
        ).first()
        
        if incomplete:
            # Delete old incomplete session
            self.db.delete(incomplete)
            self.db.commit()
        
        # Create new session
        session = TaskSession(
            user_id=user_id,
            task_id=task_id
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        config = self.get_task_config(task)
        
        logger.info(f"Started task session {session.id} for user {user_id}, task {task_id}")
        
        return session, config
    
    def submit_result(
        self,
        session_id: int,
        metric_name: str,
        metric_value: float
    ) -> TaskResult:
        """Submit a single metric result."""
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise ValueError("Task session not found")
        if session.completed_at:
            raise ValueError("Task session is already complete")
        
        # Check for existing result with same metric
        existing = self.db.query(TaskResult).filter(
            TaskResult.task_session_id == session_id,
            TaskResult.metric_name == metric_name
        ).first()
        
        if existing:
            existing.metric_value = metric_value
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        result = TaskResult(
            task_session_id=session_id,
            metric_name=metric_name,
            metric_value=metric_value
        )
        self.db.add(result)
        self.db.commit()
        self.db.refresh(result)
        
        return result
    
    def complete_session(
        self,
        session_id: int,
        results: List[Dict[str, Any]]
    ) -> TaskSession:
        """
        Complete a task session with all results.
        """
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise ValueError("Task session not found")
        if session.completed_at:
            raise ValueError("Task session is already complete")
        
        # Submit all results
        for result_data in results:
            self.submit_result(
                session_id=session_id,
                metric_name=result_data["metric_name"],
                metric_value=result_data["metric_value"]
            )
        
        # Mark session complete
        session.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(session)
        
        logger.info(f"Completed task session {session_id}")
        
        return session
    
    def get_session_with_results(self, session_id: int) -> Tuple[TaskSession, List[TaskResult]]:
        """Get a session with its results."""
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise ValueError("Task session not found")
        
        results = self.result_repo.get_by_session_id(session_id)
        return session, results
    
    def get_user_history(self, user_id: int, limit: int = 20) -> List[TaskSession]:
        """Get user's task session history."""
        return self.db.query(TaskSession).filter(
            TaskSession.user_id == user_id
        ).order_by(TaskSession.started_at.desc()).limit(limit).all()
    
    def get_user_task_progress(self, user_id: int, task_id: int) -> Dict[str, Any]:
        """Get user's progress for a specific task."""
        sessions = self.db.query(TaskSession).filter(
            TaskSession.user_id == user_id,
            TaskSession.task_id == task_id
        ).all()
        
        completed_sessions = [s for s in sessions if s.completed_at]
        
        if not completed_sessions:
            return {
                "total_attempts": len(sessions),
                "completed_attempts": 0,
                "best_score": None,
                "average_score": None,
                "last_attempt": sessions[0].started_at if sessions else None,
                "improvement_trend": None
            }
        
        # Calculate scores from results
        scores = []
        for session in completed_sessions:
            results = self.result_repo.get_by_session_id(session.id)
            # Use primary score metric (accuracy, score, or first metric)
            score_result = next(
                (r for r in results if r.metric_name in ["accuracy", "score", "overall_accuracy"]),
                results[0] if results else None
            )
            if score_result:
                scores.append(score_result.metric_value)
        
        # Calculate trend
        trend = None
        if len(scores) >= 3:
            recent_avg = sum(scores[-3:]) / 3
            older_avg = sum(scores[:-3]) / max(len(scores) - 3, 1) if len(scores) > 3 else scores[0]
            if recent_avg > older_avg * 1.05:
                trend = "improving"
            elif recent_avg < older_avg * 0.95:
                trend = "declining"
            else:
                trend = "stable"
        
        return {
            "total_attempts": len(sessions),
            "completed_attempts": len(completed_sessions),
            "best_score": max(scores) if scores else None,
            "average_score": sum(scores) / len(scores) if scores else None,
            "last_attempt": completed_sessions[0].completed_at if completed_sessions else None,
            "improvement_trend": trend
        }
    
    def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """Get overall task statistics for a user."""
        sessions = self.db.query(TaskSession).filter(
            TaskSession.user_id == user_id
        ).all()
        
        completed = [s for s in sessions if s.completed_at]
        
        # Calculate total time spent
        total_time = 0
        for session in completed:
            if session.started_at and session.completed_at:
                duration = (session.completed_at - session.started_at).total_seconds()
                total_time += duration
        
        # Find favorite task
        task_counts = {}
        for session in completed:
            task_counts[session.task_id] = task_counts.get(session.task_id, 0) + 1
        
        favorite_task_id = max(task_counts, key=task_counts.get) if task_counts else None
        favorite_task = None
        if favorite_task_id:
            task = self.get_task_by_id(favorite_task_id)
            favorite_task = task.name if task else None
        
        # Get unique tasks attempted
        unique_tasks = set(s.task_id for s in sessions)
        
        return {
            "total_tasks_attempted": len(unique_tasks),
            "total_sessions_completed": len(completed),
            "total_time_spent_seconds": int(total_time),
            "favorite_task": favorite_task
        }
    
    def calculate_performance_summary(
        self,
        task: Task,
        results: List[TaskResult]
    ) -> Dict[str, Any]:
        """Calculate performance summary for a completed task."""
        results_dict = {r.metric_name: r.metric_value for r in results}
        
        task_type = task.type.lower() if task.type else "default"
        config = TASK_CONFIG.get(task_type, DEFAULT_CONFIG)
        
        summary = {
            "metrics": results_dict,
            "interpretation": []
        }
        
        # Task-specific interpretations
        if task_type == "attention":
            accuracy = results_dict.get("accuracy", 0)
            if accuracy >= 90:
                summary["interpretation"].append("Excellent sustained attention")
            elif accuracy >= 75:
                summary["interpretation"].append("Good attention with minor lapses")
            else:
                summary["interpretation"].append("Attention difficulties noted")
        
        elif task_type == "memory":
            max_seq = results_dict.get("max_sequence", 0)
            if max_seq >= 7:
                summary["interpretation"].append("Strong working memory capacity")
            elif max_seq >= 5:
                summary["interpretation"].append("Average working memory")
            else:
                summary["interpretation"].append("Working memory may benefit from practice")
        
        elif task_type == "response_inhibition":
            nogo_acc = results_dict.get("nogo_accuracy", 0)
            if nogo_acc >= 85:
                summary["interpretation"].append("Good impulse control")
            elif nogo_acc >= 70:
                summary["interpretation"].append("Moderate response inhibition")
            else:
                summary["interpretation"].append("May struggle with impulse control")
        
        return summary
    
    def delete_incomplete_session(self, session_id: int, user_id: int) -> bool:
        """Delete an incomplete task session."""
        session = self.db.query(TaskSession).filter(
            TaskSession.id == session_id,
            TaskSession.user_id == user_id,
            TaskSession.completed_at.is_(None)
        ).first()
        
        if session:
            self.db.delete(session)
            self.db.commit()
            return True
        return False
