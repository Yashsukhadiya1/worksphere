import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.attendance import AttendanceRecord, LeaveRequest
from app.models.employee import Employee
from app.models.user import User
from app.schemas.attendance import (
    AttendanceRecordOut,
    AttendanceSummary,
    LeaveRequestCreate,
    LeaveRequestOut,
)
from app.services import notification_service

STANDARD_HOURS_PER_DAY = Decimal("8.0")


async def _get_employee_by_user(user_id: uuid.UUID, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.user_id == user_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError("Employee record not found")
    return emp


async def check_in(current_user: User, db: AsyncSession) -> AttendanceRecordOut:
    emp = await _get_employee_by_user(current_user.id, db)
    today = date.today()

    # Reject if already clocked in today (no check_out yet)
    existing = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today,
            AttendanceRecord.check_out == None,  # noqa: E711
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Already clocked in")

    record = AttendanceRecord(
        employee_id=emp.id,
        check_in=datetime.now(timezone.utc),
        date=today,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return AttendanceRecordOut.model_validate(record)


async def check_out(current_user: User, db: AsyncSession) -> AttendanceRecordOut:
    emp = await _get_employee_by_user(current_user.id, db)
    today = date.today()

    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date == today,
            AttendanceRecord.check_out == None,  # noqa: E711
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError("No active clock-in found for today")

    now = datetime.now(timezone.utc)
    record.check_out = now
    delta = now - record.check_in.replace(tzinfo=timezone.utc)
    record.total_hours = Decimal(str(round(delta.total_seconds() / 3600, 2)))
    await db.flush()
    await db.refresh(record)
    return AttendanceRecordOut.model_validate(record)


async def get_all_attendance(db: AsyncSession) -> list[AttendanceRecordOut]:
    result = await db.execute(
        select(AttendanceRecord).order_by(AttendanceRecord.date.desc())
    )
    return [AttendanceRecordOut.model_validate(r) for r in result.scalars().all()]


async def delete_attendance_record(record_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(select(AttendanceRecord).where(AttendanceRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError("Attendance record not found")
    await db.delete(record)
    await db.flush()


async def get_my_attendance(current_user: User, db: AsyncSession) -> list[AttendanceRecordOut]:
    emp = await _get_employee_by_user(current_user.id, db)
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.employee_id == emp.id)
        .order_by(AttendanceRecord.date.desc())
    )
    return [AttendanceRecordOut.model_validate(r) for r in result.scalars().all()]


async def get_employee_attendance(employee_id: uuid.UUID, db: AsyncSession) -> list[AttendanceRecordOut]:
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.employee_id == employee_id)
        .order_by(AttendanceRecord.date.desc())
    )
    return [AttendanceRecordOut.model_validate(r) for r in result.scalars().all()]


async def create_leave_request(
    data: LeaveRequestCreate,
    current_user: User,
    db: AsyncSession,
) -> LeaveRequestOut:
    emp = await _get_employee_by_user(current_user.id, db)

    leave = LeaveRequest(
        employee_id=emp.id,
        start_date=data.start_date,
        end_date=data.end_date,
        leave_type=data.leave_type,
        reason=data.reason,
    )
    db.add(leave)
    await db.flush()

    # Notify the employee's manager if set
    if emp.manager_id:
        mgr_result = await db.execute(select(Employee).where(Employee.id == emp.manager_id))
        mgr = mgr_result.scalar_one_or_none()
        if mgr:
            await notification_service.create_notification(
                user_id=mgr.user_id,
                title="New Leave Request",
                body=f"{emp.first_name} {emp.last_name} has submitted a leave request.",
                db=db,
            )

    await db.refresh(leave)
    return LeaveRequestOut.model_validate(leave)


async def _update_leave_status(
    leave_id: uuid.UUID,
    new_status: str,
    reviewer: User,
    db: AsyncSession,
) -> LeaveRequestOut:
    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise NotFoundError("Leave request not found")

    # Get reviewer employee record
    rev_emp_result = await db.execute(select(Employee).where(Employee.user_id == reviewer.id))
    rev_emp = rev_emp_result.scalar_one_or_none()

    leave.status = new_status
    leave.reviewed_by = rev_emp.id if rev_emp else None
    leave.reviewed_at = datetime.now(timezone.utc)
    await db.flush()

    # Notify the requesting employee
    emp_result = await db.execute(select(Employee).where(Employee.id == leave.employee_id))
    emp = emp_result.scalar_one()
    await notification_service.create_notification(
        user_id=emp.user_id,
        title=f"Leave Request {new_status.capitalize()}",
        body=f"Your leave request from {leave.start_date} to {leave.end_date} has been {new_status}.",
        db=db,
    )

    await db.refresh(leave)
    return LeaveRequestOut.model_validate(leave)


async def approve_leave(leave_id: uuid.UUID, reviewer: User, db: AsyncSession) -> LeaveRequestOut:
    return await _update_leave_status(leave_id, "approved", reviewer, db)


async def reject_leave(leave_id: uuid.UUID, reviewer: User, db: AsyncSession) -> LeaveRequestOut:
    return await _update_leave_status(leave_id, "rejected", reviewer, db)


async def get_my_leaves(current_user: User, db: AsyncSession) -> list[LeaveRequestOut]:
    emp = await _get_employee_by_user(current_user.id, db)
    result = await db.execute(
        select(LeaveRequest)
        .where(LeaveRequest.employee_id == emp.id)
        .order_by(LeaveRequest.created_at.desc())
    )
    return [LeaveRequestOut.model_validate(r) for r in result.scalars().all()]


async def get_all_leaves(db: AsyncSession) -> list[LeaveRequestOut]:
    result = await db.execute(
        select(LeaveRequest).order_by(LeaveRequest.created_at.desc())
    )
    return [LeaveRequestOut.model_validate(r) for r in result.scalars().all()]


async def get_attendance_summary(
    employee_id: uuid.UUID,
    period_start: date,
    period_end: date,
    db: AsyncSession,
) -> AttendanceSummary:
    # Sum total hours in period
    hours_result = await db.execute(
        select(func.coalesce(func.sum(AttendanceRecord.total_hours), 0)).where(
            and_(
                AttendanceRecord.employee_id == employee_id,
                AttendanceRecord.date >= period_start,
                AttendanceRecord.date <= period_end,
                AttendanceRecord.total_hours != None,  # noqa: E711
            )
        )
    )
    total_hours = Decimal(str(hours_result.scalar_one()))

    # Working days in period
    working_days = (period_end - period_start).days + 1
    expected_hours = Decimal(working_days) * STANDARD_HOURS_PER_DAY
    overtime = max(Decimal("0"), total_hours - expected_hours)

    # Count approved leave days
    leaves_result = await db.execute(
        select(LeaveRequest).where(
            and_(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.status == "approved",
                LeaveRequest.start_date <= period_end,
                LeaveRequest.end_date >= period_start,
            )
        )
    )
    leave_days = sum(
        (min(lr.end_date, period_end) - max(lr.start_date, period_start)).days + 1
        for lr in leaves_result.scalars().all()
    )

    return AttendanceSummary(
        employee_id=employee_id,
        total_hours=total_hours,
        overtime_hours=overtime,
        leave_days=leave_days,
    )
