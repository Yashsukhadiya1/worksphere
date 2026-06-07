import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ReviewCycleCreate(BaseModel):
    name: str
    start_date: date
    end_date: date


class ReviewCycleOut(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewCreate(BaseModel):
    cycle_id: uuid.UUID
    employee_id: uuid.UUID
    rating: int  # 1-5
    comments: Optional[str] = None


class ReviewOut(BaseModel):
    id: uuid.UUID
    cycle_id: uuid.UUID
    employee_id: uuid.UUID
    reviewer_id: uuid.UUID
    rating: int
    comments: Optional[str] = None
    submitted_at: datetime

    model_config = {"from_attributes": True}


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    employee_id: Optional[uuid.UUID] = None  # used when admin assigns to specific employee


class GoalProgressUpdate(BaseModel):
    progress: int  # 0-100


class GoalOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    title: str
    description: Optional[str] = None
    progress: int
    due_date: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CycleSummaryEntry(BaseModel):
    employee_id: uuid.UUID
    average_rating: float
    review_count: int
