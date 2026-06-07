import uuid
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user, require_roles
from app.database import get_db
from app.models.employee import Employee
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


class SendNotificationRequest(BaseModel):
    title: str
    body: str
    employee_id: Optional[uuid.UUID] = None  # None = broadcast to all


@router.post("/send", status_code=status.HTTP_204_NO_CONTENT)
async def send_notification(
    payload: SendNotificationRequest,
    current_user: User = Depends(require_roles("admin", "hr_manager")),
    db: AsyncSession = Depends(get_db),
):
    if payload.employee_id:
        result = await db.execute(select(Employee).where(Employee.id == payload.employee_id))
        emp = result.scalar_one_or_none()
        if emp:
            await notification_service.create_notification(
                emp.user_id, payload.title, payload.body, db,
                sent_by_user_id=current_user.id,
            )
    else:
        result = await db.execute(select(Employee).where(Employee.status == "active"))
        for emp in result.scalars().all():
            await notification_service.create_notification(
                emp.user_id, payload.title, payload.body, db,
                sent_by_user_id=current_user.id,
            )


@router.get("/sent", response_model=list[NotificationOut])
async def get_sent_notifications(
    current_user: User = Depends(require_roles("admin", "hr_manager")),
    db: AsyncSession = Depends(get_db),
):
    """Admin view: all notifications sent by admins, with read receipts."""
    return await notification_service.get_all_sent(db)


@router.get("", response_model=list[NotificationOut])
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notification_service.get_unread(current_user.id, db)


@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Look up employee name for the read receipt
    emp_result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    emp = emp_result.scalar_one_or_none()
    reader_name = f"{emp.first_name} {emp.last_name}" if emp else current_user.email

    await notification_service.mark_read(
        notification_id, current_user.id, db, reader_name=reader_name
    )
