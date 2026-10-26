"""Auth business logic — signup, login, refresh, password reset."""

import hashlib
import hmac
import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.exceptions import ConflictException, GinderException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.auth_session import AuthSession
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
            hashed_password=await run_in_threadpool(hash_password, body.password),
            accepted_terms=True,
            accepted_terms_at=datetime.now(UTC),
        )
        self.db.add(user)
        await self.db.flush()

        return await self._start_session(user)

    async def login(self, body: LoginRequest) -> TokenResponse:
        """Authenticate user with email/password and return tokens."""
        email = str(body.email).strip().lower()
        result = await self.db.execute(select(User).where(func.lower(User.email) == email))
        user = result.scalar_one_or_none()

        if (
            not user
            or not user.is_active
            or not await run_in_threadpool(verify_password, body.password, user.hashed_password)
        ):
            raise UnauthorizedException("Invalid email or password")

        return await self._start_session(user)

    def _issue_tokens(self, user: User, session: AuthSession) -> TokenResponse:
        refresh = create_refresh_token(str(user.id), user.token_version, str(session.id))
        session.refresh_hash = hashlib.sha256(refresh.encode()).hexdigest()
        # Rotation does not extend the original login's absolute lifetime.
        return TokenResponse(
            access_token=create_access_token(
                str(user.id), user.token_version, session_id=str(session.id)
            ),
            refresh_token=refresh,
        )

    async def _start_session(self, user: User) -> TokenResponse:
        from datetime import timedelta

        from app.core.config import settings

        session = AuthSession(
            id=uuid4(), user_id=user.id,
            expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        tokens = self._issue_tokens(user, session)
        self.db.add(session)
        await self.db.flush()
        return tokens

    async def refresh(self, body: RefreshTokenRequest) -> TokenResponse:
        """Issue new tokens from a valid refresh token."""
        payload = decode_token(body.refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid refresh token")

        try:
            user_id = UUID(payload["sub"])
            session_id = UUID(payload["sid"])
        except (KeyError, TypeError, ValueError):
            raise UnauthorizedException("Invalid refresh token") from None

        # Keep lock order consistent with reset-password: user, then session.
        result = await self.db.execute(select(User).where(User.id == user_id).with_for_update())
        user = result.scalar_one_or_none()
        if not user or not user.is_active or payload.get("ver") != user.token_version:
            raise UnauthorizedException("Invalid refresh token")

        session_result = await self.db.execute(
            select(AuthSession).where(
                AuthSession.id == session_id, AuthSession.user_id == user_id
            ).with_for_update()
        )
        session = session_result.scalar_one_or_none()
        if not session or session.revoked_at or session.expires_at <= datetime.now(UTC):
            raise UnauthorizedException("Invalid refresh token")
        if not hmac.compare_digest(
            session.refresh_hash, hashlib.sha256(body.refresh_token.encode()).hexdigest()
        ):
            # Persist replay revocation before returning 401; the request dependency
            # rolls back on exceptions, which would otherwise undo this protection.
            session.revoked_at = datetime.now(UTC)
            await self.db.commit()
            raise UnauthorizedException("Refresh token reused; please sign in again")
        tokens = self._issue_tokens(user, session)
        await self.db.flush()
        return tokens

    async def logout(self, body: RefreshTokenRequest) -> MessageResponse:
        """Idempotently revoke this login, including already-rotated tokens."""
        payload = decode_token(body.refresh_token)
        if payload and payload.get("type") == "refresh":
            try:
                user_id, session_id = UUID(payload["sub"]), UUID(payload["sid"])
            except (KeyError, TypeError, ValueError):
                pass
            else:
                result = await self.db.execute(
                    select(AuthSession).where(
                        AuthSession.id == session_id, AuthSession.user_id == user_id
                    ).with_for_update()
                )
                session = result.scalar_one_or_none()
                if session and not session.revoked_at:
                    session.revoked_at = datetime.now(UTC)
        return MessageResponse(message="Signed out")

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

        try:
            user_id = UUID(payload["sub"])
        except (KeyError, TypeError, ValueError):
            raise GinderException("Invalid or expired reset token") from None
        result = await self.db.execute(select(User).where(User.id == user_id).with_for_update())
        user = result.scalar_one_or_none()

        if not user:
            raise GinderException("Invalid reset token")

        from app.core.security import password_reset_fingerprint

        if payload.get("password_version") != password_reset_fingerprint(user.hashed_password):
            raise GinderException("Invalid or expired reset token")
        if payload.get("ver") != user.token_version:
            raise GinderException("Invalid or expired reset token")

        user.hashed_password = await run_in_threadpool(hash_password, body.new_password)
        user.token_version += 1
        return MessageResponse(message="Password has been reset successfully")
