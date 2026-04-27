"""
Task Routes

API endpoints for behavioral tasks and session management.
"""
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.task import (
    TaskResponse,
    TaskListResponse,
    TaskDetailResponse,
    TaskSessionStart,
    TaskSessionStartResponse,
    TaskSessionSubmit,
    TaskSessionResponse,
    TaskResultResponse,
    TaskSessionSummary,
    TaskHistoryResponse,
    TaskProgressResponse,
    UserTaskStatsResponse
)
from app.services.task_service import TaskService
from app.utils.dependencies import get_current_active_user
from app.services.recommendation_service import check_and_update_recommendations

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# =============================================================================
# Task Listing Endpoints
# =============================================================================

@router.get("", response_model=TaskListResponse)
async def get_all_tasks(
    task_type: Optional[str] = Query(None, description="Filter by task type"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all available behavioral tasks.
    Optionally filter by task type.
    """
    service = TaskService(db)
    
    if task_type:
        tasks = service.get_tasks_by_type(task_type)
    else:
        tasks = service.get_all_tasks()
    
    return TaskListResponse(
        tasks=[
            TaskResponse(
                id=t.id,
                name=t.name,
                type=t.type,
                pillar=t.pillar,
                category=t.category,
                description=t.description,
                instructions=service.get_task_config(t)["instructions"][:200] + "...",
                estimated_duration=service.get_task_config(t)["estimated_duration"],
                difficulty_levels=service.get_task_config(t)["difficulty_levels"]
            )
            for t in tasks
        ],
        total=len(tasks)
    )


@router.get("/{task_id}", response_model=TaskDetailResponse)
async def get_task_detail(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific task.
    Includes full instructions and configuration.
    """
    service = TaskService(db)
    task = service.get_task_by_id(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    config = service.get_task_config(task)
    
    return TaskDetailResponse(
        id=task.id,
        name=task.name,
        type=task.type,
        pillar=task.pillar,
        category=task.category,
        description=task.description,
        instructions=config["instructions"],
        estimated_duration=config["estimated_duration"],
        difficulty_levels=config["difficulty_levels"],
        config=config["config"]
    )


# =============================================================================
# Task Session Endpoints
# =============================================================================

@router.post("/sessions/start", response_model=TaskSessionStartResponse, status_code=status.HTTP_201_CREATED)
async def start_task_session(
    request: TaskSessionStart,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Start a new task session.
    
    Returns session ID and task configuration needed to run the task.
    """
    service = TaskService(db)
    
    try:
        session, config = service.start_session(current_user.id, request.task_id, request.difficulty_level)
        task = service.get_task_by_id(request.task_id)
        
        return TaskSessionStartResponse(
            session_id=session.id,
            task_id=task.id,
            task_name=task.name,
            task_type=task.type,
            pillar=task.pillar,
            category=task.category,
            difficulty_level=session.difficulty_level,
            instructions=config["instructions"],
            config=config["config"],
            started_at=session.started_at
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/sessions/{session_id}/submit", response_model=TaskSessionResponse)
async def submit_task_session(
    session_id: int,
    submission: TaskSessionSubmit,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Submit results and complete a task session.
    """
    service = TaskService(db)
    
    # Verify session belongs to user
    session, _ = service.get_session_with_results(session_id)
    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    try:
        results_data = [
            {"metric_name": r.metric_name, "metric_value": r.metric_value}
            for r in submission.results
        ]
        
        completed_session = service.complete_session(session_id, results_data)
        _, results = service.get_session_with_results(session_id)
        
        task = service.get_task_by_id(completed_session.task_id)
        duration = int((completed_session.completed_at - completed_session.started_at).total_seconds())
        
        performance_summary = service.calculate_performance_summary(task, results)
        
        result = TaskSessionResponse(
            session_id=completed_session.id,
            task_id=task.id,
            task_name=task.name,
            task_type=task.type,
            pillar=task.pillar,
            category=task.category,
            difficulty_level=completed_session.difficulty_level,
            started_at=completed_session.started_at,
            completed_at=completed_session.completed_at,
            duration_seconds=duration,
            results=[TaskResultResponse(metric_name=r.metric_name, metric_value=r.metric_value) for r in results],
            performance_summary=performance_summary
        )

        # Check if this task submission matches a pending recommendation
        background_tasks.add_task(
            check_and_update_recommendations,
            current_user.id,
            task.category or "",
            completed_session.difficulty_level,
            db,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/sessions/{session_id}", response_model=TaskSessionResponse)
async def get_task_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a completed task session.
    """
    service = TaskService(db)
    
    try:
        session, results = service.get_session_with_results(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task session not found"
        )
    
    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if not session.completed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task session is not complete"
        )
    
    task = service.get_task_by_id(session.task_id)
    duration = int((session.completed_at - session.started_at).total_seconds())
    performance_summary = service.calculate_performance_summary(task, results)
    
    return TaskSessionResponse(
        session_id=session.id,
        task_id=task.id,
        task_name=task.name,
        task_type=task.type,
        pillar=task.pillar,
        category=task.category,
        difficulty_level=session.difficulty_level,
        started_at=session.started_at,
        completed_at=session.completed_at,
        duration_seconds=duration,
        results=[TaskResultResponse(metric_name=r.metric_name, metric_value=r.metric_value) for r in results],
        performance_summary=performance_summary
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incomplete_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete an incomplete task session.
    """
    service = TaskService(db)
    deleted = service.delete_incomplete_session(session_id, current_user.id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incomplete task session not found"
        )
    
    return None


# =============================================================================
# History & Progress Endpoints
# =============================================================================

@router.get("/history/sessions", response_model=TaskHistoryResponse)
async def get_task_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user's task session history.
    """
    service = TaskService(db)
    sessions = service.get_user_history(current_user.id, limit=limit)
    
    summaries = []
    for session in sessions:
        task = service.get_task_by_id(session.task_id)
        
        # Get primary score if completed
        primary_score = None
        if session.completed_at:
            _, results = service.get_session_with_results(session.id)
            score_result = next(
                (r for r in results if r.metric_name in ["accuracy", "score", "overall_accuracy"]),
                results[0] if results else None
            )
            if score_result:
                primary_score = score_result.metric_value
        
        summaries.append(TaskSessionSummary(
            id=session.id,
            task_id=session.task_id,
            task_name=task.name if task else "Unknown",
            task_type=task.type if task else None,
            pillar=task.pillar if task else None,
            category=task.category if task else None,
            difficulty_level=session.difficulty_level,
            started_at=session.started_at,
            completed_at=session.completed_at,
            is_complete=session.completed_at is not None,
            primary_score=primary_score
        ))
    
    completed_count = sum(1 for s in summaries if s.is_complete)
    
    return TaskHistoryResponse(
        sessions=summaries,
        total=len(summaries),
        completed_count=completed_count
    )


@router.get("/progress/{task_id}", response_model=TaskProgressResponse)
async def get_task_progress(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user's progress for a specific task.
    """
    service = TaskService(db)
    task = service.get_task_by_id(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    progress = service.get_user_task_progress(current_user.id, task_id)
    
    return TaskProgressResponse(
        task_id=task.id,
        task_name=task.name,
        **progress
    )


@router.get("/stats/me", response_model=UserTaskStatsResponse)
async def get_my_task_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get overall task statistics for the current user.
    """
    service = TaskService(db)
    stats = service.get_user_stats(current_user.id)
    
    # Get progress for each task the user has attempted
    all_tasks = service.get_all_tasks()
    task_progress = []
    
    for task in all_tasks:
        progress = service.get_user_task_progress(current_user.id, task.id)
        if progress["total_attempts"] > 0:
            task_progress.append(TaskProgressResponse(
                task_id=task.id,
                task_name=task.name,
                **progress
            ))
    
    return UserTaskStatsResponse(
        **stats,
        task_progress=task_progress
    )
