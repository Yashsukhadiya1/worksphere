import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.employee import Employee
from app.models.performance import Goal, PerformanceReview, ReviewCycle
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
from app.services import notification_service


async def create_review_cycle(data: ReviewCycleCreate, actor: User, db: AsyncSession) -> ReviewCycleOut:
    cycle = ReviewCycle(
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        created_by=actor.id,
    )
    db.add(cycle)
    await db.flush()
    await db.refresh(cycle)
    return ReviewCycleOut.model_validate(cycle)


async def list_review_cycles(db: AsyncSession) -> list[ReviewCycleOut]:
    result = await db.execute(select(ReviewCycle).order_by(ReviewCycle.start_date.desc()))
    return [ReviewCycleOut.model_validate(c) for c in result.scalars().all()]


async def submit_review(data: ReviewCreate, actor: User, db: AsyncSession) -> ReviewOut:
    # Validate cycle exists and is active
    cycle_result = await db.execute(select(ReviewCycle).where(ReviewCycle.id == data.cycle_id))
    cycle = cycle_result.scalar_one_or_none()
    if not cycle:
        raise NotFoundError("Review cycle not found")

    today = date.today()
    if today > cycle.end_date:
        raise ValidationError("Review cycle has already ended")

    if not (1 <= data.rating <= 5):
        raise ValidationError("Rating must be between 1 and 5")

    review = PerformanceReview(
        cycle_id=data.cycle_id,
        employee_id=data.employee_id,
        reviewer_id=actor.id,
        rating=data.rating,
        comments=data.comments,
    )
    db.add(review)
    await db.flush()

    # Notify the reviewed employee
    emp_result = await db.execute(select(Employee).where(Employee.id == data.employee_id))
    emp = emp_result.scalar_one_or_none()
    if emp:
        await notification_service.create_notification(
            user_id=emp.user_id,
            title="Performance Review Submitted",
            body=f"A performance review has been submitted for you in cycle '{cycle.name}'.",
            db=db,
        )

    await db.refresh(review)
    return ReviewOut.model_validate(review)


async def get_my_reviews(current_user: User, db: AsyncSession) -> list[ReviewOut]:
    emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        return []
    result = await db.execute(
        select(PerformanceReview)
        .where(PerformanceReview.employee_id == emp.id)
        .order_by(PerformanceReview.submitted_at.desc())
    )
    return [ReviewOut.model_validate(r) for r in result.scalars().all()]


async def get_cycle_summary(cycle_id: uuid.UUID, db: AsyncSession) -> list[CycleSummaryEntry]:
    result = await db.execute(
        select(PerformanceReview).where(PerformanceReview.cycle_id == cycle_id)
    )
    reviews = result.scalars().all()

    # Group by employee
    by_emp: dict[uuid.UUID, list[int]] = {}
    for r in reviews:
        by_emp.setdefault(r.employee_id, []).append(r.rating)

    return [
        CycleSummaryEntry(
            employee_id=emp_id,
            average_rating=sum(ratings) / len(ratings),
            review_count=len(ratings),
        )
        for emp_id, ratings in by_emp.items()
    ]


async def create_goal(data: GoalCreate, current_user: User, db: AsyncSession) -> GoalOut:
    emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise NotFoundError("Employee record not found")

    goal = Goal(
        employee_id=emp.id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)
    return GoalOut.model_validate(goal)


async def update_goal_progress(
    goal_id: uuid.UUID,
    data: GoalProgressUpdate,
    current_user: User,
    db: AsyncSession,
) -> GoalOut:
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise NotFoundError("Goal not found")
    if not (0 <= data.progress <= 100):
        raise ValidationError("Progress must be between 0 and 100")
    goal.progress = data.progress
    await db.flush()
    await db.refresh(goal)
    return GoalOut.model_validate(goal)


async def get_my_goals(current_user: User, db: AsyncSession) -> list[GoalOut]:
    emp_result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        return []
    result = await db.execute(
        select(Goal).where(Goal.employee_id == emp.id).order_by(Goal.created_at.desc())
    )
    return [GoalOut.model_validate(g) for g in result.scalars().all()]


async def get_employee_goals(employee_id: uuid.UUID, db: AsyncSession) -> list[GoalOut]:
    result = await db.execute(
        select(Goal).where(Goal.employee_id == employee_id).order_by(Goal.created_at.desc())
    )
    return [GoalOut.model_validate(g) for g in result.scalars().all()]


async def assign_goal_to_employee(
    employee_id: uuid.UUID,
    data: GoalCreate,
    actor: User,
    db: AsyncSession,
) -> GoalOut:
    emp_result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise NotFoundError("Employee not found")

    goal = Goal(
        employee_id=employee_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
    )
    db.add(goal)
    await db.flush()

    await notification_service.create_notification(
        user_id=emp.user_id,
        title="New Goal Assigned",
        body=f"A new goal has been assigned to you: {data.title}",
        db=db,
    )

    await db.refresh(goal)
    return GoalOut.model_validate(goal)


async def get_employee_reviews(employee_id: uuid.UUID, db: AsyncSession) -> list[ReviewOut]:
    result = await db.execute(
        select(PerformanceReview)
        .where(PerformanceReview.employee_id == employee_id)
        .order_by(PerformanceReview.submitted_at.desc())
    )
    return [ReviewOut.model_validate(r) for r in result.scalars().all()]
