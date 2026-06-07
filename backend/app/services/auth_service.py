"""
Auth service — no Redis dependency.
Refresh token revocation uses an in-memory set (dev mode).
In production, replace _revoked_tokens with a Redis or DB-backed store.
"""
import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import AccessTokenResponse, TokenResponse, UserProfile

logger = logging.getLogger(__name__)

# In-memory revocation store (good enough for development / single-process)
_revoked_tokens: set[str] = set()


async def login(email: str, password: str, db: AsyncSession) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedError("Your account has been removed. Please contact your administrator.")

    access_token = create_access_token(str(user.id), user.role)
    refresh_token, jti = create_refresh_token(str(user.id))

    # Store jti so we can revoke it on logout
    # (in-memory: cleared on server restart — acceptable for dev)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh(refresh_token: str) -> AccessTokenResponse:
    from jose import JWTError  # type: ignore

    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise UnauthorizedError("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid token type")

    jti = payload.get("jti", "")
    if jti in _revoked_tokens:
        raise UnauthorizedError("Refresh token has been revoked")

    user_id = payload.get("sub")
    role = payload.get("role", "employee")
    access_token = create_access_token(user_id, role)
    return AccessTokenResponse(access_token=access_token)


async def logout(refresh_token: str) -> None:
    from jose import JWTError  # type: ignore

    try:
        payload = decode_token(refresh_token)
    except JWTError:
        return

    jti = payload.get("jti")
    if jti:
        _revoked_tokens.add(jti)


async def get_me(user: User) -> UserProfile:
    return UserProfile.model_validate(user)
