"""Auth business logic — signup, login, refresh, password reset."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def signup(self, body: SignUpRequest) -> TokenResponse:
        """Register a new user and return tokens."""
        if not body.accepted_terms:
            raise GinderException("You must accept the Terms of Service to sign up")

        # Check duplicate email
        result = await self.db.execute(select(User).where(User.email == body.email))
        if result.scalar_one_or_none():
            raise ConflictException("Email already registered")

        user = User(
            email=body.email,
            display_name=body.display_name,
            hashed_password=hash_password(body.password),
            accepted_terms=True,
        )
        self.db.add(user)
        await self.db.flush()

        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def login(self, body: LoginRequest) -> TokenResponse:
        """Authenticate user with email/password and return tokens."""
        result = await self.db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(body.password, user.hashed_password):
            raise UnauthorizedException("Invalid email or password")

        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def refresh(self, body: RefreshTokenRequest) -> TokenResponse:
        """Issue new tokens from a valid refresh token."""
        payload = decode_token(body.refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid refresh token")

        user_id = payload.get("sub")
        return TokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
        )

    async def forgot_password(self, body: ForgotPasswordRequest) -> MessageResponse:
        """Start the password reset flow.

        Always reports success, whether or not the address exists, so the
        endpoint cannot be used to discover which emails are registered.
        """
        result = await self.db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()

        if user:
            token = create_password_reset_token(str(user.id))
            await self._deliver_reset_token(user.email, token)

        return MessageResponse(message="If the email exists, a reset link has been sent")

    async def _deliver_reset_token(self, email: str, token: str) -> None:
        """Deliver a password reset token to the user.

        Email delivery is not implemented yet. Until it is, the token is logged
        so the reset flow can still be exercised end to end in development.
        The log line is suppressed outside development because a reset token is
        a credential.
        """
        # TODO: send a real email using the SMTP_* settings.
        if settings.DEBUG:
            logger.warning("Password reset token for %s: %s", email, token)
        else:
            logger.error(
                "Password reset requested for %s but email delivery is not configured.",
                email,
            )

    async def reset_password(self, body: ResetPasswordRequest) -> MessageResponse:
        """Reset the user's password using a valid reset token."""
        payload = decode_token(body.token)
        if not payload or payload.get("type") != "password_reset":
            raise GinderException("Invalid or expired reset token")

        user_id = payload.get("sub")
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise GinderException("Invalid reset token")

        user.hashed_password = hash_password(body.new_password)
        return MessageResponse(message="Password has been reset successfully")
