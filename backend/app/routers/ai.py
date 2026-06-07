from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.ai import (
    AIQueryRequest,
    AIQueryResult,
    AttritionRiskEntry,
    BurnoutWarningResult,
    DepartmentRankEntry,
    EmployeeMonthlyRecord,
    InsightReport,
    ProductivityScoreResult,
)
from app.services import ai_service, ml_service

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Existing Gemini endpoints ────────────────────────────────────────────────

@router.post("/insights", response_model=InsightReport)
async def insights(
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.generate_insights(db)


@router.post("/query", response_model=AIQueryResult)
async def query(
    body: AIQueryRequest,
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await ai_service.natural_language_query(body.query, db)


# ── Dataset endpoints ────────────────────────────────────────────────────────

@router.post("/dataset/refresh")
async def refresh_admin_dataset(
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Force-rebuild the admin dataset CSV from current DB data."""
    from app.services.dataset_service import refresh_dataset, dataset_last_updated
    await refresh_dataset(db)
    return {"message": "Dataset refreshed successfully.", "last_updated": dataset_last_updated()}


@router.get("/dataset/status")
async def dataset_status(
    _: User = Depends(require_roles("hr_manager", "admin")),
):
    """Returns when the admin dataset was last built and whether it's stale."""
    from app.services.dataset_service import dataset_last_updated, dataset_is_stale
    return {
        "last_updated": dataset_last_updated(),
        "is_stale": dataset_is_stale(),
    }


# ── Admin ML endpoints ───────────────────────────────────────────────────────

@router.get("/ml/attrition-risk", response_model=list[AttritionRiskEntry])
async def attrition_risk(
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Returns attrition risk score for every active employee, sorted high to low."""
    return await ml_service.attrition_risk_scores(db)


@router.get("/ml/department-ranking", response_model=list[DepartmentRankEntry])
async def department_ranking(
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Ranks departments by composite performance + attendance score."""
    return await ml_service.department_ranking(db)


@router.get("/ml/admin-dataset")
async def admin_dataset(
    _: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Downloads admin dataset as CSV — one row per employee with all ML features."""
    csv_data = await ml_service.build_admin_dataset(db)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=admin_dataset.csv"},
    )


# ── Employee ML endpoints ────────────────────────────────────────────────────

@router.get("/ml/productivity", response_model=ProductivityScoreResult)
async def my_productivity(
    current_user: User = Depends(require_roles("employee", "dept_manager", "hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Returns the logged-in employee's productivity score for today."""
    # Resolve user → employee id
    from sqlalchemy import select
    from app.models.employee import Employee
    emp = (await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )).scalar_one_or_none()
    if emp is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Employee profile not found for this user")
    return await ml_service.productivity_score(str(emp.id), db)


@router.get("/ml/burnout", response_model=BurnoutWarningResult)
async def my_burnout(
    current_user: User = Depends(require_roles("employee", "dept_manager", "hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Checks if the logged-in employee is showing burnout signals."""
    from sqlalchemy import select
    from app.models.employee import Employee
    emp = (await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )).scalar_one_or_none()
    if emp is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Employee profile not found for this user")
    return await ml_service.burnout_warning(str(emp.id), db)


@router.get("/ml/my-dataset", response_model=list[EmployeeMonthlyRecord])
async def my_dataset(
    current_user: User = Depends(require_roles("employee", "dept_manager", "hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Returns the last 6 months of the employee's own data as structured records."""
    from sqlalchemy import select
    from app.models.employee import Employee
    emp = (await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )).scalar_one_or_none()
    if emp is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Employee profile not found for this user")
    return await ml_service.build_employee_dataset(str(emp.id), db)


# ── Admin: per-employee ML lookup ────────────────────────────────────────────

@router.get("/ml/employee/{employee_id}/productivity", response_model=ProductivityScoreResult)
async def employee_productivity(
    employee_id: str,
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: get productivity score for any specific employee."""
    from app.core.exceptions import NotFoundError
    from sqlalchemy import select
    from app.models.employee import Employee
    emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if emp is None:
        raise NotFoundError("Employee not found")
    return await ml_service.productivity_score(employee_id, db)


@router.get("/ml/employee/{employee_id}/burnout", response_model=BurnoutWarningResult)
async def employee_burnout(
    employee_id: str,
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: get burnout warning for any specific employee."""
    from app.core.exceptions import NotFoundError
    from sqlalchemy import select
    from app.models.employee import Employee
    emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if emp is None:
        raise NotFoundError("Employee not found")
    return await ml_service.burnout_warning(employee_id, db)


@router.get("/ml/employee/{employee_id}/history", response_model=list[EmployeeMonthlyRecord])
async def employee_history(
    employee_id: str,
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin: get 6-month history for any specific employee."""
    from app.core.exceptions import NotFoundError
    from sqlalchemy import select
    from app.models.employee import Employee
    emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if emp is None:
        raise NotFoundError("Employee not found")
    return await ml_service.build_employee_dataset(employee_id, db)
