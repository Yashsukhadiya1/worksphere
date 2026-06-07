"""
Creates a test employee user for mobile app testing.
Usage: python seed_employee.py
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.models.employee import Employee
from app.models.department import Department
from app.core.security import hash_password
from app.config import settings
from datetime import date
from decimal import Decimal


async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Create a department if none exists
        dept_result = await session.execute(select(Department).limit(1))
        dept = dept_result.scalar_one_or_none()
        if not dept:
            dept = Department(name="Engineering")
            session.add(dept)
            await session.flush()
            print(f"Created department: Engineering ({dept.id})")

        # Check if user already exists
        existing = await session.execute(select(User).where(User.email == "employee@eems.com"))
        if existing.scalar_one_or_none():
            print("Employee user already exists: employee@eems.com / Employee@123")
            return

        # Create user
        user = User(
            email="employee@eems.com",
            hashed_password=hash_password("Employee@123"),
            role="employee",
            is_active=True,
        )
        session.add(user)
        await session.flush()

        # Create employee record
        emp = Employee(
            user_id=user.id,
            employee_number="EMP-TEST001",
            first_name="Test",
            last_name="Employee",
            job_title="Software Engineer",
            department_id=dept.id,
            hire_date=date(2024, 1, 1),
            base_salary=Decimal("50000.00"),
        )
        session.add(emp)
        await session.commit()

        print("✅ Employee user created")
        print("   Email:    employee@eems.com")
        print("   Password: Employee@123")
        print("   Role:     employee")


if __name__ == "__main__":
    asyncio.run(main())
