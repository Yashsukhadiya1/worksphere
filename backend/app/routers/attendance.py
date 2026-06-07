import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user, require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.attendance import (
    AttendanceRecordOut,
    AttendanceSummary,
    LeaveRequestCreate,
    LeaveRequestOut,
)
from app.services import attendance_service

router = APIRouter(tags=["attendance"])


@router.post("/attendance/checkin", response_model=AttendanceRecordOut, status_code=status.HTTP_201_CREATED)
async def check_in(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.check_in(current_user, db)


@router.post("/attendance/checkout", response_model=AttendanceRecordOut)
async def check_out(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.check_out(current_user, db)


@router.get("/attendance/me", response_model=list[AttendanceRecordOut])
async def my_attendance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.get_my_attendance(current_user, db)


@router.get("/attendance/all", response_model=list[AttendanceRecordOut])
async def all_attendance(
    _: User = Depends(require_roles("admin", "hr_manager", "dept_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.get_all_attendance(db)


@router.delete("/attendance/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance_record(
    record_id: uuid.UUID,
    _: User = Depends(require_roles("admin", "hr_manager")),
    db: AsyncSession = Depends(get_db),
):
    await attendance_service.delete_attendance_record(record_id, db)


@router.get("/attendance/{employee_id}", response_model=list[AttendanceRecordOut])
async def employee_attendance(
    employee_id: uuid.UUID,
    _: User = Depends(require_roles("admin", "hr_manager", "dept_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.get_employee_attendance(employee_id, db)


@router.get("/attendance/{employee_id}/summary", response_model=AttendanceSummary)
async def attendance_summary(
    employee_id: uuid.UUID,
    period_start: date = Query(...),
    period_end: date = Query(...),
    _: User = Depends(require_roles("admin", "hr_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.get_attendance_summary(employee_id, period_start, period_end, db)


@router.post("/leave/request", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
async def request_leave(
    body: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.create_leave_request(body, current_user, db)


@router.put("/leave/{leave_id}/approve", response_model=LeaveRequestOut)
async def approve_leave(
    leave_id: uuid.UUID,
    current_user: User = Depends(require_roles("dept_manager", "hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.approve_leave(leave_id, current_user, db)


@router.put("/leave/{leave_id}/reject", response_model=LeaveRequestOut)
async def reject_leave(
    leave_id: uuid.UUID,
    current_user: User = Depends(require_roles("dept_manager", "hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.reject_leave(leave_id, current_user, db)


@router.get("/leave/me", response_model=list[LeaveRequestOut])
async def my_leaves(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.get_my_leaves(current_user, db)


@router.get("/leave/all", response_model=list[LeaveRequestOut])
async def all_leaves(
    _: User = Depends(require_roles("admin", "hr_manager", "dept_manager")),
    db: AsyncSession = Depends(get_db),
):
    return await attendance_service.get_all_leaves(db)
