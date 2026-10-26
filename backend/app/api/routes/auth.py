"""Auth routes — signup, login, refresh, password reset."""

from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.redis import get_redis
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SignUpRequest,
    TokenResponse,
)
from app.services.auth_service import AuthService
from app.services.rate_limit_service import allow_password_reset, limit_auth_requests

router = APIRouter(dependencies=[Depends(limit_auth_requests)])


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(body: SignUpRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    service = AuthService(db)
    return await service.signup(body)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with email and password."""
    service = AuthService(db)
    return await service.login(body)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refresh an access token."""
    service = AuthService(db)
    return await service.refresh(body)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Send a password reset email."""
    client_ip = request.client.host if request.client else "unknown"
    if not await allow_password_reset(redis, str(body.email), client_ip):
        return MessageResponse(message="If the email exists, a reset link has been sent")
    service = AuthService(db)
    return await service.forgot_password(body)


@router.post("/logout", response_model=MessageResponse)
async def logout(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService(db).logout(body)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password with a valid reset token."""
    service = AuthService(db)
    return await service.reset_password(body)
