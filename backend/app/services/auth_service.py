"""Auth business logic — signup, login, refresh, password reset."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, GinderException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SignUpRequest,
    TokenResponse,
)
from app.services.email_service import send_password_reset

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def signup(self, body: SignUpRequest) -> TokenResponse:
        """Register a new user and return tokens."""
        if not body.accepted_terms:
            raise GinderException("You must accept the Terms of Service to sign up")

        # Check duplicate email
        email = str(body.email).strip().lower()
        result = await self.db.execute(select(User).where(func.lower(User.email) == email))
        if result.scalar_one_or_none():
            raise ConflictException("Email already registered")

        user = User(
            email=email,
            display_name=body.display_name.strip(),
            hashed_password=hash_password(body.password),
            accepted_terms=True,
            accepted_terms_at=datetime.now(UTC),
        )
        self.db.add(user)
        await self.db.flush()

        return TokenResponse(
            access_token=create_access_token(str(user.id), user.token_version),
            refresh_token=create_refresh_token(str(user.id), user.token_version),
        )

    async def login(self, body: LoginRequest) -> TokenResponse:
        """Authenticate user with email/password and return tokens."""
        email = str(body.email).strip().lower()
        result = await self.db.execute(select(User).where(func.lower(User.email) == email))
        user = result.scalar_one_or_none()

        if (
            not user
            or not user.is_active
            or not verify_password(body.password, user.hashed_password)
        ):
            raise UnauthorizedException("Invalid email or password")

        return TokenResponse(
            access_token=create_access_token(str(user.id), user.token_version),
            refresh_token=create_refresh_token(str(user.id), user.token_version),
        )

    async def refresh(self, body: RefreshTokenRequest) -> TokenResponse:
        """Issue new tokens from a valid refresh token."""
        payload = decode_token(body.refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid refresh token")

        try:
            user_id = UUID(payload["sub"])
        except (KeyError, TypeError, ValueError):
            raise UnauthorizedException("Invalid refresh token") from None

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active or payload.get("ver") != user.token_version:
            raise UnauthorizedException("Invalid refresh token")

        return TokenResponse(
            access_token=create_access_token(str(user.id), user.token_version),
            refresh_token=create_refresh_token(str(user.id), user.token_version),
        )

    async def forgot_password(self, body: ForgotPasswordRequest) -> MessageResponse:
        """Start the password reset flow.

        Always reports success, whether or not the address exists, so the
        endpoint cannot be used to discover which emails are registered.
        """
        email = str(body.email).strip().lower()
        result = await self.db.execute(select(User).where(func.lower(User.email) == email))
        user = result.scalar_one_or_none()

        if user:
            token = create_password_reset_token(
                str(user.id), user.hashed_password, user.token_version
            )
            await self._deliver_reset_token(user.email, token)

        return MessageResponse(message="If the email exists, a reset link has been sent")

    async def _deliver_reset_token(self, email: str, token: str) -> None:
        """Keep the same public response for registered and unknown addresses."""
        await send_password_reset(email, token)

    async def reset_password(self, body: ResetPasswordRequest) -> MessageResponse:
        """Reset the user's password using a valid reset token."""
        payload = decode_token(body.token)
        if not payload or payload.get("type") != "password_reset":
            raise GinderException("Invalid or expired reset token")

        user_id = payload.get("sub")
        result = await self.db.execute(select(User).where(User.id == user_id).with_for_update())
        user = result.scalar_one_or_none()

        if not user:
            raise GinderException("Invalid reset token")

        from app.core.security import password_reset_fingerprint

        if payload.get("password_version") != password_reset_fingerprint(user.hashed_password):
            raise GinderException("Invalid or expired reset token")
        if payload.get("ver") != user.token_version:
            raise GinderException("Invalid or expired reset token")

        user.hashed_password = hash_password(body.new_password)
        user.token_version += 1
        return MessageResponse(message="Password has been reset successfully")
