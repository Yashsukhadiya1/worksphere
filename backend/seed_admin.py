"""
Run this once to create the initial admin user.
Usage: python seed_admin.py
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.core.security import hash_password
from app.config import settings


async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        user = User(
            email="admin@eems.com",
            hashed_password=hash_password("Admin@123"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        print("✅ Admin user created successfully")
        print("   Email:    admin@eems.com")
        print("   Password: Admin@123")
        print("   Role:     admin")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
