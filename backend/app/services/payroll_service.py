import csv
import io
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.models.employee import Employee
from app.models.payroll import PayrollRun, Payslip
from app.models.user import User
from app.schemas.payroll import PayrollRunRequest, PayrollRunSummary, PayslipOut
from app.services import notification_service

TAX_RATE = Decimal("0.15")
INSURANCE_RATE = Decimal("0.05")


def _compute_deductions(gross: Decimal) -> tuple[Decimal, dict]:
    tax = (gross * TAX_RATE).quantize(Decimal("0.01"))
    insurance = (gross * INSURANCE_RATE).quantize(Decimal("0.01"))
    total = tax + insurance
    details = {"tax": float(tax), "insurance": float(insurance)}
    return total, details


async def run_payroll(
    data: PayrollRunRequest,
    actor: User,
    db: AsyncSession,
) -> PayrollRunSummary:
    # Reject duplicate run
    existing = await db.execute(
        select(PayrollRun).where(
            and_(
                PayrollRun.pay_period_start == data.pay_period_start,
                PayrollRun.pay_period_end == data.pay_period_end,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Payroll already processed for this period")

    payroll_run = PayrollRun(
        pay_period_start=data.pay_period_start,
        pay_period_end=data.pay_period_end,
        run_by=actor.id,
    )
    db.add(payroll_run)
    await db.flush()

    # Generate payslips for all active employees
    emp_result = await db.execute(select(Employee).where(Employee.status == "active"))
    employees = emp_result.scalars().all()

    for emp in employees:
        gross = emp.base_salary
        deductions, details = _compute_deductions(gross)
        net = gross - deductions

        payslip = Payslip(
            payroll_run_id=payroll_run.id,
            employee_id=emp.id,
            gross_salary=gross,
            total_deductions=deductions,
            net_salary=net,
            deduction_details=details,
        )
        db.add(payslip)
        await db.flush()

        await notification_service.create_notification(
            user_id=emp.user_id,
            title="Payslip Available",
            body=f"Your payslip for {data.pay_period_start} – {data.pay_period_end} is ready.",
            db=db,
        )

    return PayrollRunSummary(
        id=payroll_run.id,
        pay_period_start=data.pay_period_start,
        pay_period_end=data.pay_period_end,
        payslip_count=len(employees),
    )


async def get_my_payslips(current_user: User, db: AsyncSession) -> list[PayslipOut]:
    from app.models.employee import Employee as Emp
    emp_result = await db.execute(select(Emp).where(Emp.user_id == current_user.id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        return []
    result = await db.execute(
        select(Payslip)
        .where(Payslip.employee_id == emp.id)
        .order_by(Payslip.created_at.desc())
    )
    return [PayslipOut.model_validate(p) for p in result.scalars().all()]


async def get_payslip(payslip_id: uuid.UUID, db: AsyncSession) -> PayslipOut:
    from app.core.exceptions import NotFoundError
    result = await db.execute(select(Payslip).where(Payslip.id == payslip_id))
    p = result.scalar_one_or_none()
    if not p:
        raise NotFoundError("Payslip not found")
    return PayslipOut.model_validate(p)


async def export_payroll_csv(payroll_run_id: uuid.UUID, db: AsyncSession) -> str:
    from app.core.exceptions import NotFoundError
    run_result = await db.execute(select(PayrollRun).where(PayrollRun.id == payroll_run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise NotFoundError("Payroll run not found")

    slips_result = await db.execute(
        select(Payslip).where(Payslip.payroll_run_id == payroll_run_id)
    )
    slips = slips_result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["id", "employee_id", "gross_salary", "total_deductions", "net_salary", "created_at"],
    )
    writer.writeheader()
    for s in slips:
        writer.writerow({
            "id": str(s.id),
            "employee_id": str(s.employee_id),
            "gross_salary": str(s.gross_salary),
            "total_deductions": str(s.total_deductions),
            "net_salary": str(s.net_salary),
            "created_at": str(s.created_at),
        })
    return output.getvalue()
