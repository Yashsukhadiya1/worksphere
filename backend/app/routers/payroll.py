import uuid

from fastapi import APIRouter, Depends, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user, require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.payroll import PayrollRunRequest, PayrollRunSummary, PayslipOut
from app.services import payroll_service

router = APIRouter(prefix="/payroll", tags=["payroll"])


@router.post("/run", response_model=PayrollRunSummary, status_code=status.HTTP_201_CREATED)
async def run_payroll(
    body: PayrollRunRequest,
    current_user: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    return await payroll_service.run_payroll(body, current_user, db)


@router.get("/payslips/me", response_model=list[PayslipOut])
async def my_payslips(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await payroll_service.get_my_payslips(current_user, db)


@router.get("/payslips/{payslip_id}", response_model=PayslipOut)
async def get_payslip(
    payslip_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await payroll_service.get_payslip(payslip_id, db)


@router.get("/export/{payroll_run_id}", response_class=PlainTextResponse)
async def export_csv(
    payroll_run_id: uuid.UUID,
    _: User = Depends(require_roles("hr_manager", "admin")),
    db: AsyncSession = Depends(get_db),
):
    csv_content = await payroll_service.export_payroll_csv(payroll_run_id, db)
    return PlainTextResponse(content=csv_content, media_type="text/csv")
