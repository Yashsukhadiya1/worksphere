"""
Update admin email and password.
Usage: python update_admin.py
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.core.security import hash_password
from app.config import settings

NEW_EMAIL = "admin@gmail.com"
NEW_PASSWORD = "admin@1234"


async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.role == "admin"))
        admin = result.scalar_one_or_none()

        if not admin:
            print("❌ No admin user found.")
            return

        print(f"Current email: {admin.email}")
        admin.email = NEW_EMAIL
        admin.hashed_password = hash_password(NEW_PASSWORD)
        await session.commit()

        print("✅ Admin updated.")
        print(f"   Email:    {NEW_EMAIL}")
        print(f"   Password: {NEW_PASSWORD}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
