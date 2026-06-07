"""
Reset password for any user by email.
Usage: python reset_password.py
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from app.models.user import User
from app.core.security import hash_password
from app.config import settings


async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # List all users so you can see what exists
        result = await session.execute(select(User.email, User.role, User.is_active))
        users = result.all()
        print("\n=== Current Users ===")
        for u in users:
            print(f"  {u.email}  |  role: {u.role}  |  active: {u.is_active}")

        # Reset password for the employee
        email = "Ysukhadiya11@gmail.com"
        new_password = "Pass@1234"

        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            # Try case-insensitive
            result = await session.execute(
                select(User).where(User.email.ilike(email))
            )
            user = result.scalar_one_or_none()

        if user:
            user.hashed_password = hash_password(new_password)
            user.is_active = True
            await session.commit()
            print(f"\n✅ Password reset for: {user.email}")
            print(f"   New password: {new_password}")
        else:
            print(f"\n❌ User '{email}' not found in database")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
