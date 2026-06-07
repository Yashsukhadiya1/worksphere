"""
Dataset Service — maintains backend/data/admin_dataset.csv on disk.

The CSV is rebuilt from live DB data on demand (via API) or automatically
when it's stale (older than STALE_MINUTES). ai_service reads this file
as context for Gemini so all admin queries are answered from real data.
"""

import os
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ml_service import build_admin_dataset

# Path relative to where uvicorn is launched (backend/)
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "admin_dataset.csv")
DATASET_PATH = os.path.normpath(DATASET_PATH)

STALE_MINUTES = 60  # rebuild if file is older than this


def _ensure_data_dir() -> None:
    os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)


def dataset_is_stale() -> bool:
    """Returns True if the CSV doesn't exist or is older than STALE_MINUTES."""
    if not os.path.exists(DATASET_PATH):
        return True
    age_seconds = (datetime.now(timezone.utc).timestamp() - os.path.getmtime(DATASET_PATH))
    return age_seconds > STALE_MINUTES * 60


async def refresh_dataset(db: AsyncSession) -> str:
    """Rebuild the CSV from DB and write to disk. Returns the file path."""
    _ensure_data_dir()
    csv_content = await build_admin_dataset(db)
    with open(DATASET_PATH, "w", newline="", encoding="utf-8") as f:
        f.write(csv_content)
    return DATASET_PATH


def load_dataset_as_text() -> str:
    """Read the CSV file and return it as a plain text string for Gemini context."""
    if not os.path.exists(DATASET_PATH):
        return ""
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        return f.read()


def dataset_last_updated() -> str | None:
    """Return ISO timestamp of when the CSV was last written, or None."""
    if not os.path.exists(DATASET_PATH):
        return None
    ts = os.path.getmtime(DATASET_PATH)
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
