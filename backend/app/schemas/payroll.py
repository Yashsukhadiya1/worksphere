import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel


class PayrollRunRequest(BaseModel):
    pay_period_start: date
    pay_period_end: date


class PayslipOut(BaseModel):
    id: uuid.UUID
    payroll_run_id: uuid.UUID
    employee_id: uuid.UUID
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    deduction_details: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PayrollRunSummary(BaseModel):
    id: uuid.UUID
    pay_period_start: date
    pay_period_end: date
    payslip_count: int
