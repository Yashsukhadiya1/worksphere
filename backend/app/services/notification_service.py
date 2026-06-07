import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.notification import Notification
from app.schemas.notification import NotificationOut


async def create_notification(
    user_id: uuid.UUID,
    title: str,
    body: str,
    db: AsyncSession,
    sent_by_user_id: uuid.UUID | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        sent_by_user_id=sent_by_user_id,
    )
    db.add(notif)
    await db.flush()
    return notif


async def get_unread(user_id: uuid.UUID, db: AsyncSession) -> list[NotificationOut]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .order_by(Notification.created_at.desc())
    )
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]


async def mark_read(
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
    reader_name: str | None = None,
) -> None:
    from app.core.exceptions import NotFoundError
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise NotFoundError("Notification not found")
    notif.is_read = True
    notif.read_by_name = reader_name
    notif.read_at = datetime.now(timezone.utc)
    await db.flush()


async def get_sent_by_user(sender_user_id: uuid.UUID, db: AsyncSession) -> list[NotificationOut]:
    """All notifications sent by a specific admin/hr user."""
    result = await db.execute(
        select(Notification)
        .where(Notification.sent_by_user_id == sender_user_id)
        .order_by(Notification.created_at.desc())
    )
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]


async def get_all_sent(db: AsyncSession) -> list[NotificationOut]:
    """All admin-sent notifications (for super admin view)."""
    result = await db.execute(
        select(Notification)
        .where(Notification.sent_by_user_id.isnot(None))
        .order_by(Notification.created_at.desc())
    )
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]
