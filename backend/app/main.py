from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.exceptions import register_exception_handlers
from app.routers import (
    ai,
    attendance,
    audit_logs,
    auth,
    departments,
    employees,
    notifications,
    payroll,
    performance,
)

app = FastAPI(title="EEMS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(employees.router, prefix=PREFIX)
app.include_router(departments.router, prefix=PREFIX)
app.include_router(attendance.router, prefix=PREFIX)
app.include_router(payroll.router, prefix=PREFIX)
app.include_router(performance.router, prefix=PREFIX)
app.include_router(ai.router, prefix=PREFIX)
app.include_router(notifications.router, prefix=PREFIX)
app.include_router(audit_logs.router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok"}
