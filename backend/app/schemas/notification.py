import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    sent_by_user_id: Optional[uuid.UUID] = None
    title: str
    body: str
    is_read: bool
    read_by_name: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
