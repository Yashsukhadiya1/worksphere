import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user, require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeDetail, EmployeeSummary, EmployeeUpdate
from app.services import employee_service

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeSummary])
async def list_employees(
    name: Optional[str] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    role: Optional[str] = Query(None),
    emp_status: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(require_roles("admin", "hr_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.list_employees(db, name, department_id, role, emp_status)


@router.post("", response_model=EmployeeDetail, status_code=status.HTTP_201_CREATED)
async def create_employee(
    body: EmployeeCreate,
    current_user: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.create_employee(body, current_user, db)


@router.get("/{employee_id}", response_model=EmployeeDetail)
async def get_employee(
    employee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.get_employee(employee_id, current_user, db)


@router.put("/{employee_id}", response_model=EmployeeDetail)
async def update_employee(
    employee_id: uuid.UUID,
    body: EmployeeUpdate,
    current_user: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await employee_service.update_employee(employee_id, body, current_user, db)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_employee(
    employee_id: uuid.UUID,
    current_user: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    await employee_service.deactivate_employee(employee_id, current_user, db)


@router.delete("/{employee_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee_permanent(
    employee_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    await employee_service.delete_employee_permanent(employee_id, current_user, db)


@router.patch("/{employee_id}/activate", status_code=status.HTTP_204_NO_CONTENT)
async def activate_employee(
    employee_id: uuid.UUID,
    current_user: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    await employee_service.activate_employee(employee_id, current_user, db)
