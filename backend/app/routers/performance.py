import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user, require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.performance import (
    CycleSummaryEntry,
    GoalCreate,
    GoalOut,
    GoalProgressUpdate,
    ReviewCreate,
    ReviewCycleCreate,
    ReviewCycleOut,
    ReviewOut,
)
from app.services import performance_service

router = APIRouter(prefix="/performance", tags=["performance"])


@router.post("/cycles", response_model=ReviewCycleOut, status_code=status.HTTP_201_CREATED)
async def create_cycle(
    body: ReviewCycleCreate,
    current_user: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.create_review_cycle(body, current_user, db)


@router.get("/cycles", response_model=list[ReviewCycleOut])
async def list_cycles(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.list_review_cycles(db)


@router.get("/cycles/{cycle_id}/summary", response_model=list[CycleSummaryEntry])
async def cycle_summary(
    cycle_id: uuid.UUID,
    _: User = Depends(require_roles("hr_manager", "admin", "dept_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.get_cycle_summary(cycle_id, db)


@router.post("/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def submit_review(
    body: ReviewCreate,
    current_user: User = Depends(require_roles("dept_manager", "hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.submit_review(body, current_user, db)


@router.get("/reviews/me", response_model=list[ReviewOut])
async def my_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.get_my_reviews(current_user, db)


@router.post("/goals", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.create_goal(body, current_user, db)


@router.put("/goals/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: uuid.UUID,
    body: GoalProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.update_goal_progress(goal_id, body, current_user, db)


@router.get("/goals/me", response_model=list[GoalOut])
async def my_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.get_my_goals(current_user, db)


@router.get("/goals/employee/{employee_id}", response_model=list[GoalOut])
async def employee_goals(
    employee_id: uuid.UUID,
    _: User = Depends(require_roles("hr_manager", "admin", "dept_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.get_employee_goals(employee_id, db)


@router.post("/goals/assign", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def assign_goal(
    body: GoalCreate,
    employee_id: uuid.UUID,
    current_user: User = Depends(require_roles("hr_manager", "admin", "dept_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.assign_goal_to_employee(employee_id, body, current_user, db)


@router.get("/reviews/employee/{employee_id}", response_model=list[ReviewOut])
async def employee_reviews(
    employee_id: uuid.UUID,
    _: User = Depends(require_roles("hr_manager", "admin", "dept_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await performance_service.get_employee_reviews(employee_id, db)
