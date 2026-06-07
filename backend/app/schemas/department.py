import uuid
from datetime import datetime

from pydantic import BaseModel


class DepartmentCreate(BaseModel):
    name: str


class DepartmentUpdate(BaseModel):
    name: str


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentSummary(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}
