import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel


class AttendanceRecordOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    check_in: datetime
    check_out: Optional[datetime] = None
    total_hours: Optional[Decimal] = None
    date: date

    model_config = {"from_attributes": True}


class LeaveRequestCreate(BaseModel):
    start_date: date
    end_date: date
    leave_type: Literal["annual", "sick", "unpaid", "other"]
    reason: Optional[str] = None


class LeaveRequestOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    start_date: date
    end_date: date
    leave_type: str
    status: str
    reason: Optional[str] = None
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AttendanceSummary(BaseModel):
    employee_id: uuid.UUID
    total_hours: Decimal
    overtime_hours: Decimal
    leave_days: int
