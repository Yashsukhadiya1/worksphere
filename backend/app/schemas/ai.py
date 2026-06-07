from typing import Any, Optional

from pydantic import BaseModel


class AIQueryRequest(BaseModel):
    query: str


class InsightReport(BaseModel):
    summary: str
    flagged_employees: list[str] = []
    generated_at: str


class AIQueryResult(BaseModel):
    query: str
    result: str
    structured_data: Optional[dict[str, Any]] = None


# --- ML Schemas ---

class AttritionRiskEntry(BaseModel):
    employee_id: str
    name: str
    job_title: str
    risk_score: int
    risk_level: str
    factors: dict[str, Any]


class DepartmentRankEntry(BaseModel):
    rank: int
    department_id: str
    department_name: str
    employee_count: int
    avg_performance_rating: float
    attendance_rate_30d: float
    composite_score: float


class ProductivityScoreResult(BaseModel):
    score: int
    level: str
    breakdown: dict[str, Any]
    date: str


class BurnoutWarningResult(BaseModel):
    consecutive_working_days: int
    warning: bool
    message: str


class EmployeeMonthlyRecord(BaseModel):
    month: str
    present_days: int
    avg_hours_per_day: float
    approved_leaves: int
    performance_rating: Optional[int] = None
    net_salary: Optional[float] = None
