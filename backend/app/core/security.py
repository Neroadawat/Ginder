"""JWT token creation/verification and password hashing."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from jwt import InvalidTokenError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


# ─── Password Hashing ───


def hash_password(password: str) -> str:
    """Hash a plain-text password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ─── JWT Tokens ───


def _token_claims(subject: str, token_type: str, expire: datetime, token_version: int) -> dict:
    now = datetime.now(UTC)
    return {
        "sub": subject,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "type": token_type,
        "ver": token_version,
    }


def create_access_token(
    subject: str,
    token_version: int = 0,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token."""
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode = _token_claims(subject, "access", expire, token_version)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str, token_version: int = 0) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = _token_claims(subject, "refresh", expire, token_version)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def password_reset_fingerprint(hashed_password: str) -> str:
    return hashlib.sha256(hashed_password.encode()).hexdigest()


def create_password_reset_token(
    subject: str,
    hashed_password: str,
    token_version: int = 0,
) -> str:
    """Create a short-lived token for password reset."""
    expire = datetime.now(UTC) + timedelta(minutes=15)
    to_encode = _token_claims(subject, "password_reset", expire, token_version)
    to_encode["password_version"] = password_reset_fingerprint(hashed_password)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
            options={"require": ["sub", "exp", "iat", "jti", "iss", "aud", "type", "ver"]},
        )
        return payload
    except InvalidTokenError:
        return None
