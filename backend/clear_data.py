"""
Clears all employee-related data from the database.
Keeps the admin user intact.
Usage: python clear_data.py
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.config import settings


async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Order matters — delete child tables first to avoid FK violations
        tables = [
            "audit_logs",
            "notifications",
            "performance_reviews",
            "goals",
            "review_cycles",
            "payslips",
            "payroll_runs",
            "attendance_records",
            "leave_requests",
            "employees",
        ]

        for table in tables:
            await session.execute(text(f"DELETE FROM {table}"))
            print(f"  Cleared: {table}")

        # Delete all users except admin
        await session.execute(text("DELETE FROM users WHERE role != 'admin'"))
        print("  Cleared: users (non-admin)")

        await session.commit()
        print("\n✅ All employee data cleared. Admin account preserved.")
        print("   You can now add fresh employees from the web dashboard.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
