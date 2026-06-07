import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr

from app.schemas.department import DepartmentSummary


class EmployeeCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    job_title: str
    department_id: uuid.UUID
    hire_date: date
    base_salary: Decimal
    role: Literal["hr_manager", "dept_manager", "employee"]
    password: str


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    base_salary: Optional[Decimal] = None
    role: Optional[Literal["hr_manager", "dept_manager", "employee"]] = None
    manager_id: Optional[uuid.UUID] = None


class EmployeeDetail(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    employee_number: str
    first_name: str
    last_name: str
    job_title: str
    department: Optional[DepartmentSummary] = None
    hire_date: date
    base_salary: Decimal
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeSummary(BaseModel):
    id: uuid.UUID
    employee_number: str
    first_name: str
    last_name: str
    job_title: str
    department: Optional[DepartmentSummary] = None
    status: str

    model_config = {"from_attributes": True}
