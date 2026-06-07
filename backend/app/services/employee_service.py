import uuid
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeDetail, EmployeeSummary, EmployeeUpdate
from app.services import audit_service, notification_service


def _generate_employee_number(employee_id: uuid.UUID) -> str:
    return f"EMP-{str(employee_id).split('-')[0].upper()}"


async def _load_employee(employee_id: uuid.UUID, db: AsyncSession) -> Employee:
    result = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError("Employee not found")
    return emp


async def create_employee(
    data: EmployeeCreate,
    actor: User,
    db: AsyncSession,
) -> EmployeeDetail:
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise ConflictError("Email already registered")

    # Create user account
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.flush()  # get user.id

    # Create employee record
    emp = Employee(
        user_id=user.id,
        employee_number=_generate_employee_number(user.id),
        first_name=data.first_name,
        last_name=data.last_name,
        job_title=data.job_title,
        department_id=data.department_id,
        hire_date=data.hire_date,
        base_salary=data.base_salary,
    )
    db.add(emp)
    await db.flush()

    # Reload with relationships
    emp = await _load_employee(emp.id, db)

    # Welcome notification
    await notification_service.create_notification(
        user_id=user.id,
        title="Welcome to EEMS",
        body=f"Hello {data.first_name}, your employee account has been created.",
        db=db,
    )

    # Audit
    await audit_service.log(
        actor_id=actor.id,
        action="CREATE",
        entity_type="Employee",
        entity_id=str(emp.id),
        db=db,
        payload={"email": data.email, "role": data.role},
    )

    return EmployeeDetail.model_validate(emp)


async def get_employee(
    employee_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> EmployeeDetail:
    emp = await _load_employee(employee_id, db)

    # Employees can only view their own profile
    if current_user.role == "employee" and emp.user_id != current_user.id:
        raise ForbiddenError("You can only view your own profile")

    return EmployeeDetail.model_validate(emp)


async def list_employees(
    db: AsyncSession,
    name: Optional[str] = None,
    department_id: Optional[uuid.UUID] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
) -> list[EmployeeSummary]:
    query = (
        select(Employee)
        .options(selectinload(Employee.department))
        .join(User, Employee.user_id == User.id)
    )
    if name:
        query = query.where(
            or_(
                Employee.first_name.ilike(f"%{name}%"),
                Employee.last_name.ilike(f"%{name}%"),
            )
        )
    if department_id:
        query = query.where(Employee.department_id == department_id)
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(Employee.status == status)

    result = await db.execute(query)
    return [EmployeeSummary.model_validate(e) for e in result.scalars().all()]


async def update_employee(
    employee_id: uuid.UUID,
    data: EmployeeUpdate,
    actor: User,
    db: AsyncSession,
) -> EmployeeDetail:
    emp = await _load_employee(employee_id, db)
    changed: dict = {}

    if data.first_name is not None and emp.first_name != data.first_name:
        changed["first_name"] = {"old": emp.first_name, "new": data.first_name}
        emp.first_name = data.first_name
    if data.last_name is not None and emp.last_name != data.last_name:
        changed["last_name"] = {"old": emp.last_name, "new": data.last_name}
        emp.last_name = data.last_name
    if data.job_title is not None and emp.job_title != data.job_title:
        changed["job_title"] = {"old": emp.job_title, "new": data.job_title}
        emp.job_title = data.job_title
    if data.department_id is not None and emp.department_id != data.department_id:
        changed["department_id"] = {"old": str(emp.department_id), "new": str(data.department_id)}
        emp.department_id = data.department_id
    if data.base_salary is not None and emp.base_salary != data.base_salary:
        changed["base_salary"] = {"old": str(emp.base_salary), "new": str(data.base_salary)}
        emp.base_salary = data.base_salary
    if data.role is not None:
        user_result = await db.execute(select(User).where(User.id == emp.user_id))
        user = user_result.scalar_one()
        if user.role != data.role:
            changed["role"] = {"old": user.role, "new": data.role}
            user.role = data.role
    if data.manager_id is not None and emp.manager_id != data.manager_id:
        changed["manager_id"] = {"old": str(emp.manager_id), "new": str(data.manager_id)}
        emp.manager_id = data.manager_id

    if changed:
        await db.flush()
        await audit_service.log(
            actor_id=actor.id,
            action="UPDATE",
            entity_type="Employee",
            entity_id=str(emp.id),
            db=db,
            payload={"changes": changed},
        )

    emp = await _load_employee(emp.id, db)
    return EmployeeDetail.model_validate(emp)


async def activate_employee(
    employee_id: uuid.UUID,
    actor: User,
    db: AsyncSession,
) -> None:
    emp = await _load_employee(employee_id, db)
    emp.status = "active"
    user_result = await db.execute(select(User).where(User.id == emp.user_id))
    user = user_result.scalar_one()
    user.is_active = True
    await db.flush()
    await audit_service.log(
        actor_id=actor.id,
        action="ACTIVATE",
        entity_type="Employee",
        entity_id=str(emp.id),
        db=db,
    )


async def deactivate_employee(
    employee_id: uuid.UUID,
    actor: User,
    db: AsyncSession,
) -> None:
    emp = await _load_employee(employee_id, db)
    emp.status = "inactive"

    # Revoke login access
    user_result = await db.execute(select(User).where(User.id == emp.user_id))
    user = user_result.scalar_one()
    user.is_active = False

    await db.flush()
    await audit_service.log(
        actor_id=actor.id,
        action="DEACTIVATE",
        entity_type="Employee",
        entity_id=str(emp.id),
        db=db,
    )


async def delete_employee_permanent(
    employee_id: uuid.UUID,
    actor: User,
    db: AsyncSession,
) -> None:
    from app.models.attendance import AttendanceRecord, LeaveRequest
    from app.models.payroll import Payslip
    from app.models.performance import Goal, PerformanceReview

    emp = await _load_employee(employee_id, db)
    user_id = emp.user_id

    await audit_service.log(
        actor_id=actor.id,
        action="DELETE",
        entity_type="Employee",
        entity_id=str(emp.id),
        db=db,
        payload={"permanent": True},
    )

    # Delete all related records first
    for model, field in [
        (AttendanceRecord, AttendanceRecord.employee_id),
        (LeaveRequest, LeaveRequest.employee_id),
        (Payslip, Payslip.employee_id),
        (PerformanceReview, PerformanceReview.employee_id),
        (Goal, Goal.employee_id),
    ]:
        rows = await db.execute(select(model).where(field == emp.id))
        for row in rows.scalars().all():
            await db.delete(row)
    await db.flush()

    # Delete employee row, then user
    await db.delete(emp)
    await db.flush()
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        await db.delete(user)
    await db.flush()
