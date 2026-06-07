import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate


async def list_departments(db: AsyncSession) -> list[DepartmentOut]:
    result = await db.execute(select(Department).order_by(Department.name))
    return [DepartmentOut.model_validate(d) for d in result.scalars().all()]


async def create_department(data: DepartmentCreate, db: AsyncSession) -> DepartmentOut:
    existing = await db.execute(select(Department).where(Department.name == data.name))
    if existing.scalar_one_or_none():
        raise ConflictError(f"Department '{data.name}' already exists")
    dept = Department(name=data.name)
    db.add(dept)
    await db.flush()
    await db.refresh(dept)
    return DepartmentOut.model_validate(dept)


async def update_department(dept_id: uuid.UUID, data: DepartmentUpdate, db: AsyncSession) -> DepartmentOut:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundError("Department not found")
    dept.name = data.name
    await db.flush()
    await db.refresh(dept)
    return DepartmentOut.model_validate(dept)


async def delete_department(dept_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundError("Department not found")

    # Reject if active employees are assigned to this department
    count_result = await db.execute(
        select(func.count()).select_from(Employee).where(
            Employee.department_id == dept_id,
            Employee.status == "active",
        )
    )
    active_count = count_result.scalar_one()
    if active_count > 0:
        raise ConflictError(f"Cannot delete department: {active_count} active employee(s) still assigned")

    await db.delete(dept)
