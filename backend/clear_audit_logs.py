"""
Clears only the audit_logs table.
Usage: python clear_audit_logs.py
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
        await session.execute(text("DELETE FROM audit_logs"))
        await session.commit()
        print("✅ audit_logs cleared.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
