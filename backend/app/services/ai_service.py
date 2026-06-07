import json
import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ServiceUnavailableError
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.payroll import Payslip
from app.models.performance import PerformanceReview
from app.schemas.ai import AIQueryResult, InsightReport

logger = logging.getLogger(__name__)


_MODELS = [
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-pro",
]


def _get_gemini(api_key: str):
    """Return (genai module, configured api_key). Raises if key is empty."""
    import google.generativeai as genai  # type: ignore
    key = api_key.strip()
    if not key:
        raise ValueError("GEMINI_API_KEY is empty")
    genai.configure(api_key=key)
    return genai


def _generate(prompt: str) -> str:
    """Try each model in order until one succeeds. Returns response text."""
    import google.generativeai as genai  # type: ignore
    genai_mod = _get_gemini(settings.GEMINI_API_KEY)
    last_err = None
    for model_name in _MODELS:
        try:
            model = genai_mod.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as exc:
            msg = str(exc)
            # 404 = model not found, try next
            if "404" in msg or "not found" in msg.lower():
                last_err = exc
                continue
            # 429 = quota, bubble up immediately
            raise
    raise ServiceUnavailableError(
        f"No working Gemini model found. Last error: {last_err}"
    )


async def _aggregate_data(db: AsyncSession) -> dict:
    emp_count = (await db.execute(
        select(func.count()).select_from(Employee).where(Employee.status == "active")
    )).scalar_one()
    avg_rating_row = (await db.execute(select(func.avg(PerformanceReview.rating)))).scalar_one()
    avg_rating = round(float(avg_rating_row), 2) if avg_rating_row else None
    payslip_count = (await db.execute(select(func.count()).select_from(Payslip))).scalar_one()
    attendance_count = (await db.execute(select(func.count()).select_from(AttendanceRecord))).scalar_one()
    return {
        "active_employees": emp_count,
        "average_performance_rating": avg_rating,
        "total_payslips_issued": payslip_count,
        "total_attendance_records": attendance_count,
    }


async def generate_insights(db: AsyncSession) -> InsightReport:
    data = await _aggregate_data(db)

    prompt = (
        "You are an HR analytics AI. Given the following workforce metrics, "
        "provide a concise natural-language insight summary (3-5 sentences) and list any notable anomalies.\n\n"
        f"Metrics: {data}\n\n"
        "Respond in JSON with keys: summary (string), flagged_employees (list of strings)."
    )

    try:
        text = _generate(prompt)
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        parsed = json.loads(text.strip())
        return InsightReport(
            summary=parsed.get("summary", "No summary available."),
            flagged_employees=parsed.get("flagged_employees", []),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.error("generate_insights failed: %s", exc)
        # Fallback — build insight from raw data without Gemini
        d = data
        rating = d["average_performance_rating"]
        summary = (
            f"The organization currently has {d['active_employees']} active employees. "
            f"Average performance rating is {rating if rating else 'not yet recorded'}. "
            f"A total of {d['total_payslips_issued']} payslips have been issued and "
            f"{d['total_attendance_records']} attendance records exist. "
            f"Note: AI-powered analysis unavailable — add a valid GEMINI_API_KEY for richer insights."
        )
        return InsightReport(
            summary=summary,
            flagged_employees=[],
            generated_at=datetime.now(timezone.utc).isoformat(),
        )


async def natural_language_query(query_text: str, db: AsyncSession) -> AIQueryResult:
    """
    Answer admin questions using the admin dataset CSV as context via Gemini.
    Auto-rebuilds dataset on every query to ensure data is fresh.
    """
    from app.services.dataset_service import load_dataset_as_text, refresh_dataset

    # Always rebuild so answers reflect current DB state
    await refresh_dataset(db)
    dataset_text = load_dataset_as_text()

    if not dataset_text:
        raise ServiceUnavailableError(
            "Dataset is empty. Please try again — it should auto-build."
        )

    prompt = (
        "You are an HR data assistant for an enterprise employee management system.\n"
        "You have the following employee dataset in CSV format. "
        "Use ONLY this data to answer the question accurately.\n"
        "Be specific — use real names, numbers, and dates from the data.\n"
        "Do NOT say 'I don't have access' or give generic answers. "
        "If the answer is genuinely not in the data, say exactly what is missing.\n\n"
        f"DATASET:\n{dataset_text}\n\n"
        f"QUESTION: {query_text}\n\n"
        "Answer:"
    )

    try:
        result_text = _generate(prompt)
        return AIQueryResult(query=query_text, result=result_text)
    except ServiceUnavailableError:
        raise
    except Exception as exc:
        logger.error("natural_language_query failed: %s", exc)
        msg = str(exc)
        if "429" in msg or "quota" in msg.lower():
            raise ServiceUnavailableError(
                "Gemini API quota exceeded. Please wait a moment and try again, "
                "or enable billing at https://aistudio.google.com to remove limits."
            ) from exc
        raise ServiceUnavailableError(f"AI query failed: {exc}") from exc



