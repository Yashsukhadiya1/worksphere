import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user, require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.services import department_service

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await department_service.list_departments(db)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    body: DepartmentCreate,
    _: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await department_service.create_department(body, db)


@router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: uuid.UUID,
    body: DepartmentUpdate,
    _: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await department_service.update_department(dept_id, body, db)


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: uuid.UUID,
    _: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    await department_service.delete_department(dept_id, db)
