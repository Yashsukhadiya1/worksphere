"""
ML Service — pure Python rule-based scoring, no external ML libraries needed.
All features derived directly from existing DB data.

Admin features:
  - attrition_risk_scores()  → risk score per employee (0-100)
  - department_ranking()     → departments ranked by performance
  - build_admin_dataset()    → CSV string of org-wide employee data

Employee features:
  - productivity_score()     → today's personal score (0-100)
  - burnout_warning()        → consecutive days worked without leave
  - build_employee_dataset() → employee's own history as list of dicts
"""

import csv
import io
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceRecord, LeaveRequest
from app.models.employee import Employee
from app.models.payroll import Payslip
from app.models.performance import Goal, PerformanceReview


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today() -> date:
    return datetime.now(timezone.utc).date()


def _days_since(d: date) -> int:
    return (_today() - d).days


# ---------------------------------------------------------------------------
# ADMIN — Attrition Risk
# ---------------------------------------------------------------------------

async def attrition_risk_scores(db: AsyncSession) -> list[dict]:
    """
    Score each active employee 0-100 for attrition risk.
    Higher = more at risk. Based on:
      - Absences in last 30 days (weight 40)
      - Leave requests in last 90 days (weight 30)
      - Latest performance rating (weight 30, lower rating = higher risk)
    """
    thirty_days_ago = _today() - timedelta(days=30)
    ninety_days_ago = _today() - timedelta(days=90)

    employees = (await db.execute(
        select(Employee).where(Employee.status == "active")
    )).scalars().all()

    results = []
    for emp in employees:
        # Absences: days in last 30 with no attendance record
        present_days = (await db.execute(
            select(func.count()).select_from(AttendanceRecord)
            .where(AttendanceRecord.employee_id == emp.id)
            .where(AttendanceRecord.date >= thirty_days_ago)
        )).scalar_one()
        # Working days in last 30 (approximate as 22)
        absence_rate = max(0, (22 - present_days)) / 22  # 0.0 - 1.0

        # Leave requests in last 90 days
        leave_count = (await db.execute(
            select(func.count()).select_from(LeaveRequest)
            .where(LeaveRequest.employee_id == emp.id)
            .where(LeaveRequest.created_at >= datetime.combine(ninety_days_ago, datetime.min.time()))
        )).scalar_one()
        leave_score = min(leave_count / 5, 1.0)  # cap at 5 requests

        # Latest performance rating (1=worst → risk=1.0, 5=best → risk=0.0)
        latest_rating = (await db.execute(
            select(PerformanceReview.rating)
            .where(PerformanceReview.employee_id == emp.id)
            .order_by(PerformanceReview.submitted_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        perf_risk = (5 - (latest_rating or 3)) / 4  # 0.0 - 1.0

        score = round((absence_rate * 40) + (leave_score * 30) + (perf_risk * 30))

        results.append({
            "employee_id": str(emp.id),
            "name": f"{emp.first_name} {emp.last_name}",
            "job_title": emp.job_title,
            "risk_score": score,
            "risk_level": "High" if score >= 60 else ("Medium" if score >= 35 else "Low"),
            "factors": {
                "absence_rate_30d": round(absence_rate * 100),
                "leave_requests_90d": leave_count,
                "latest_rating": latest_rating,
            },
        })

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# ADMIN — Department Ranking
# ---------------------------------------------------------------------------

async def department_ranking(db: AsyncSession) -> list[dict]:
    """
    Rank departments by composite score:
      - Average performance rating (60%)
      - Attendance rate last 30 days (40%)
    """
    thirty_days_ago = _today() - timedelta(days=30)

    # Get all active employees with departments
    employees = (await db.execute(
        select(Employee).where(Employee.status == "active").where(Employee.department_id.isnot(None))
    )).scalars().all()

    dept_data: dict[str, dict] = {}
    for emp in employees:
        dept_id = str(emp.department_id)
        if dept_id not in dept_data:
            dept_data[dept_id] = {"ratings": [], "attendance_scores": [], "employee_count": 0}

        dept_data[dept_id]["employee_count"] += 1

        rating = (await db.execute(
            select(PerformanceReview.rating)
            .where(PerformanceReview.employee_id == emp.id)
            .order_by(PerformanceReview.submitted_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        if rating:
            dept_data[dept_id]["ratings"].append(rating)

        present = (await db.execute(
            select(func.count()).select_from(AttendanceRecord)
            .where(AttendanceRecord.employee_id == emp.id)
            .where(AttendanceRecord.date >= thirty_days_ago)
        )).scalar_one()
        dept_data[dept_id]["attendance_scores"].append(min(present / 22, 1.0))

    # Resolve department names
    from app.models.department import Department
    dept_rows = (await db.execute(select(Department))).scalars().all()
    dept_names = {str(d.id): d.name for d in dept_rows}

    ranking = []
    for dept_id, data in dept_data.items():
        avg_rating = sum(data["ratings"]) / len(data["ratings"]) if data["ratings"] else 3.0
        avg_attendance = sum(data["attendance_scores"]) / len(data["attendance_scores"]) if data["attendance_scores"] else 0.5
        composite = round((avg_rating / 5 * 60) + (avg_attendance * 40), 1)
        ranking.append({
            "department_id": dept_id,
            "department_name": dept_names.get(dept_id, "Unknown"),
            "employee_count": data["employee_count"],
            "avg_performance_rating": round(avg_rating, 2),
            "attendance_rate_30d": round(avg_attendance * 100, 1),
            "composite_score": composite,
        })

    ranking.sort(key=lambda x: x["composite_score"], reverse=True)
    for i, dept in enumerate(ranking):
        dept["rank"] = i + 1
    return ranking


# ---------------------------------------------------------------------------
# ADMIN — Dataset Export (CSV)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# ADMIN — Dataset Export (CSV)  — rich version
# ---------------------------------------------------------------------------

async def build_admin_dataset(db: AsyncSession) -> str:
    """
    Build a comprehensive CSV dataset — one row per employee.
    Includes: personal info, salary, attendance, leaves, payroll history,
    performance ratings, goals, department name.
    Refreshed on demand; used by Gemini to answer admin questions.
    """
    from app.models.department import Department

    thirty_days_ago = _today() - timedelta(days=30)
    ninety_days_ago = _today() - timedelta(days=90)

    # Pre-load departments
    dept_rows = (await db.execute(select(Department))).scalars().all()
    dept_map = {str(d.id): d.name for d in dept_rows}

    employees = (await db.execute(select(Employee))).scalars().all()

    output = io.StringIO()
    fieldnames = [
        "employee_id", "employee_number", "full_name", "first_name", "last_name",
        "job_title", "department_name", "hire_date", "days_employed",
        "base_salary", "status",
        # Attendance
        "present_days_last_30d", "absent_days_last_30d",
        "present_days_last_90d",
        # Leave
        "total_leave_requests", "approved_leaves", "rejected_leaves",
        "pending_leaves", "leave_days_taken",
        # Payroll
        "total_payslips", "latest_gross_salary", "latest_net_salary",
        "latest_deductions", "latest_payslip_date",
        # Performance
        "latest_rating", "avg_rating", "total_reviews",
        # Goals
        "total_goals", "completed_goals", "in_progress_goals", "not_started_goals",
        "avg_goal_progress",
        # Dataset meta
        "dataset_generated_at",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    for emp in employees:
        dept_name = dept_map.get(str(emp.department_id), "") if emp.department_id else ""

        # ── Attendance ──
        present_30 = (await db.execute(
            select(func.count()).select_from(AttendanceRecord)
            .where(AttendanceRecord.employee_id == emp.id)
            .where(AttendanceRecord.date >= thirty_days_ago)
        )).scalar_one()

        present_90 = (await db.execute(
            select(func.count()).select_from(AttendanceRecord)
            .where(AttendanceRecord.employee_id == emp.id)
            .where(AttendanceRecord.date >= ninety_days_ago)
        )).scalar_one()

        absent_30 = max(0, 22 - present_30)  # approx working days

        # ── Leave ──
        total_leaves = (await db.execute(
            select(func.count()).select_from(LeaveRequest)
            .where(LeaveRequest.employee_id == emp.id)
        )).scalar_one()

        approved_leaves = (await db.execute(
            select(func.count()).select_from(LeaveRequest)
            .where(LeaveRequest.employee_id == emp.id)
            .where(LeaveRequest.status == "approved")
        )).scalar_one()

        rejected_leaves = (await db.execute(
            select(func.count()).select_from(LeaveRequest)
            .where(LeaveRequest.employee_id == emp.id)
            .where(LeaveRequest.status == "rejected")
        )).scalar_one()

        pending_leaves = (await db.execute(
            select(func.count()).select_from(LeaveRequest)
            .where(LeaveRequest.employee_id == emp.id)
            .where(LeaveRequest.status == "pending")
        )).scalar_one()

        # Total approved leave days
        approved_leave_rows = (await db.execute(
            select(LeaveRequest.start_date, LeaveRequest.end_date)
            .where(LeaveRequest.employee_id == emp.id)
            .where(LeaveRequest.status == "approved")
        )).fetchall()
        leave_days = sum(
            (r.end_date - r.start_date).days + 1
            for r in approved_leave_rows
        )

        # ── Payroll ──
        total_payslips = (await db.execute(
            select(func.count()).select_from(Payslip)
            .where(Payslip.employee_id == emp.id)
        )).scalar_one()

        latest_payslip = (await db.execute(
            select(Payslip)
            .where(Payslip.employee_id == emp.id)
            .order_by(Payslip.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        # ── Performance ──
        latest_rating = (await db.execute(
            select(PerformanceReview.rating)
            .where(PerformanceReview.employee_id == emp.id)
            .order_by(PerformanceReview.submitted_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        avg_rating = (await db.execute(
            select(func.avg(PerformanceReview.rating))
            .where(PerformanceReview.employee_id == emp.id)
        )).scalar_one()

        total_reviews = (await db.execute(
            select(func.count()).select_from(PerformanceReview)
            .where(PerformanceReview.employee_id == emp.id)
        )).scalar_one()

        # ── Goals ──
        total_goals = (await db.execute(
            select(func.count()).select_from(Goal)
            .where(Goal.employee_id == emp.id)
        )).scalar_one()

        completed_goals = (await db.execute(
            select(func.count()).select_from(Goal)
            .where(Goal.employee_id == emp.id)
            .where(Goal.progress == 100)
        )).scalar_one()

        in_progress_goals = (await db.execute(
            select(func.count()).select_from(Goal)
            .where(Goal.employee_id == emp.id)
            .where(Goal.progress > 0)
            .where(Goal.progress < 100)
        )).scalar_one()

        not_started_goals = (await db.execute(
            select(func.count()).select_from(Goal)
            .where(Goal.employee_id == emp.id)
            .where(Goal.progress == 0)
        )).scalar_one()

        avg_goal_progress = (await db.execute(
            select(func.avg(Goal.progress))
            .where(Goal.employee_id == emp.id)
        )).scalar_one()

        writer.writerow({
            "employee_id": str(emp.id),
            "employee_number": emp.employee_number,
            "full_name": f"{emp.first_name} {emp.last_name}",
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "job_title": emp.job_title,
            "department_name": dept_name,
            "hire_date": emp.hire_date.isoformat(),
            "days_employed": _days_since(emp.hire_date),
            "base_salary": float(emp.base_salary),
            "status": emp.status,
            # Attendance
            "present_days_last_30d": present_30,
            "absent_days_last_30d": absent_30,
            "present_days_last_90d": present_90,
            # Leave
            "total_leave_requests": total_leaves,
            "approved_leaves": approved_leaves,
            "rejected_leaves": rejected_leaves,
            "pending_leaves": pending_leaves,
            "leave_days_taken": leave_days,
            # Payroll
            "total_payslips": total_payslips,
            "latest_gross_salary": float(latest_payslip.gross_salary) if latest_payslip else "",
            "latest_net_salary": float(latest_payslip.net_salary) if latest_payslip else "",
            "latest_deductions": float(latest_payslip.total_deductions) if latest_payslip else "",
            "latest_payslip_date": latest_payslip.created_at.strftime("%Y-%m-%d") if latest_payslip else "",
            # Performance
            "latest_rating": latest_rating if latest_rating else "",
            "avg_rating": round(float(avg_rating), 2) if avg_rating else "",
            "total_reviews": total_reviews,
            # Goals
            "total_goals": total_goals,
            "completed_goals": completed_goals,
            "in_progress_goals": in_progress_goals,
            "not_started_goals": not_started_goals,
            "avg_goal_progress": round(float(avg_goal_progress), 1) if avg_goal_progress else 0,
            # Meta
            "dataset_generated_at": generated_at,
        })

    return output.getvalue()



# ---------------------------------------------------------------------------
# EMPLOYEE — Productivity Score
# ---------------------------------------------------------------------------

async def productivity_score(employee_id: str, db: AsyncSession) -> dict:
    """
    Personal score 0-100 for today based on:
      - Checked in today (40 pts)
      - Hours worked >= 8 (20 pts)
      - At least 1 goal with progress > 0 (20 pts)
      - No pending leave today (20 pts)
    """
    today = _today()
    score = 0
    breakdown = {}

    # Check-in today
    record = (await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.employee_id == employee_id)
        .where(AttendanceRecord.date == today)
        .order_by(AttendanceRecord.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    if record:
        score += 40
        breakdown["checked_in"] = True
        if record.total_hours and float(record.total_hours) >= 8:
            score += 20
            breakdown["full_hours"] = True
        else:
            breakdown["full_hours"] = False
    else:
        breakdown["checked_in"] = False
        breakdown["full_hours"] = False

    # Goals status
    completed_goals = (await db.execute(
        select(func.count()).select_from(Goal)
        .where(Goal.employee_id == employee_id)
        .where(Goal.progress == 100)
    )).scalar_one()

    in_progress_goals = (await db.execute(
        select(func.count()).select_from(Goal)
        .where(Goal.employee_id == employee_id)
        .where(Goal.progress > 0)
        .where(Goal.progress < 100)
    )).scalar_one()

    if completed_goals > 0:
        goal_status = "completed"
        score += 20
    elif in_progress_goals > 0:
        goal_status = "in_progress"
        score += 20
    else:
        goal_status = "not_started"
    breakdown["goals_in_progress"] = goal_status

    # No leave today
    on_leave = (await db.execute(
        select(func.count()).select_from(LeaveRequest)
        .where(LeaveRequest.employee_id == employee_id)
        .where(LeaveRequest.status == "approved")
        .where(LeaveRequest.start_date <= today)
        .where(LeaveRequest.end_date >= today)
    )).scalar_one()
    if on_leave == 0:
        score += 20
        breakdown["not_on_leave"] = True
    else:
        breakdown["not_on_leave"] = False

    return {
        "score": score,
        "level": "Excellent" if score >= 80 else ("Good" if score >= 60 else ("Average" if score >= 40 else "Low")),
        "breakdown": breakdown,
        "date": today.isoformat(),
    }


# ---------------------------------------------------------------------------
# EMPLOYEE — Burnout Warning
# ---------------------------------------------------------------------------

async def burnout_warning(employee_id: str, db: AsyncSession) -> dict:
    """
    Count consecutive working days (with attendance) without any approved leave.
    Warn if >= 10 consecutive days.
    """
    today = _today()
    consecutive = 0
    check_date = today

    for _ in range(30):  # look back max 30 days
        on_leave = (await db.execute(
            select(func.count()).select_from(LeaveRequest)
            .where(LeaveRequest.employee_id == employee_id)
            .where(LeaveRequest.status == "approved")
            .where(LeaveRequest.start_date <= check_date)
            .where(LeaveRequest.end_date >= check_date)
        )).scalar_one()

        if on_leave > 0:
            break  # hit a leave day, stop counting

        attended = (await db.execute(
            select(func.count()).select_from(AttendanceRecord)
            .where(AttendanceRecord.employee_id == employee_id)
            .where(AttendanceRecord.date == check_date)
        )).scalar_one()

        if attended > 0:
            consecutive += 1
        # skip weekends / absent days silently, only count actual attendance

        check_date -= timedelta(days=1)

    warning = consecutive >= 10
    return {
        "consecutive_working_days": consecutive,
        "warning": warning,
        "message": (
            f"You've worked {consecutive} consecutive days without a break. Consider taking time off."
            if warning else
            f"You've worked {consecutive} consecutive days. Keep it up!"
        ),
    }


# ---------------------------------------------------------------------------
# EMPLOYEE — Personal Dataset
# ---------------------------------------------------------------------------

async def build_employee_dataset(employee_id: str, db: AsyncSession) -> list[dict]:
    """
    Return employee's own attendance + performance + payroll history as
    a list of monthly summary dicts (last 6 months).
    """
    records = []
    today = _today()

    for i in range(6):
        # Calculate month start/end
        month_offset = today.month - i
        year = today.year + (month_offset - 1) // 12
        month = ((month_offset - 1) % 12) + 1
        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)

        present_days = (await db.execute(
            select(func.count()).select_from(AttendanceRecord)
            .where(AttendanceRecord.employee_id == employee_id)
            .where(AttendanceRecord.date >= month_start)
            .where(AttendanceRecord.date <= month_end)
        )).scalar_one()

        avg_hours = (await db.execute(
            select(func.avg(AttendanceRecord.total_hours))
            .where(AttendanceRecord.employee_id == employee_id)
            .where(AttendanceRecord.date >= month_start)
            .where(AttendanceRecord.date <= month_end)
        )).scalar_one()

        leaves = (await db.execute(
            select(func.count()).select_from(LeaveRequest)
            .where(LeaveRequest.employee_id == employee_id)
            .where(LeaveRequest.status == "approved")
            .where(LeaveRequest.start_date >= month_start)
            .where(LeaveRequest.start_date <= month_end)
        )).scalar_one()

        rating = (await db.execute(
            select(PerformanceReview.rating)
            .where(PerformanceReview.employee_id == employee_id)
            .where(PerformanceReview.submitted_at >= datetime.combine(month_start, datetime.min.time()))
            .where(PerformanceReview.submitted_at <= datetime.combine(month_end, datetime.max.time()))
            .order_by(PerformanceReview.submitted_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        payslip = (await db.execute(
            select(Payslip.net_salary)
            .where(Payslip.employee_id == employee_id)
            .where(Payslip.created_at >= datetime.combine(month_start, datetime.min.time()))
            .where(Payslip.created_at <= datetime.combine(month_end, datetime.max.time()))
            .order_by(Payslip.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        records.append({
            "month": month_start.strftime("%Y-%m"),
            "present_days": present_days,
            "avg_hours_per_day": round(float(avg_hours), 2) if avg_hours else 0,
            "approved_leaves": leaves,
            "performance_rating": rating,
            "net_salary": float(payslip) if payslip else None,
        })

    return records
