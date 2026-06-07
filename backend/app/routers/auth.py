from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserProfile,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(body.email, body.password, db)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(body: RefreshRequest):
    return await auth_service.refresh(body.refresh_token)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest):
    await auth_service.logout(body.refresh_token)


@router.get("/me", response_model=UserProfile)
async def me(current_user: User = Depends(get_current_user)):
    return await auth_service.get_me(current_user)
