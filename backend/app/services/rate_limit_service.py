"""Small Redis-backed limits for abuse-prone public endpoints."""

import hashlib
import logging

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)


def _digest(value: str) -> str:
    return hashlib.sha256(value.strip().casefold().encode()).hexdigest()


async def _within_limit(redis: Redis, key: str, limit: int, window_seconds: int) -> bool:
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window_seconds)
    return count <= limit


async def allow_password_reset(redis: Redis, email: str, client_ip: str) -> bool:
    """Limit both an address and a network source without storing either in Redis."""
    try:
        email_ok = await _within_limit(
            redis,
            f"rate:password-reset:email:{_digest(email)}",
            settings.PASSWORD_RESET_EMAIL_LIMIT,
            settings.PASSWORD_RESET_WINDOW_SECONDS,
        )
        ip_ok = await _within_limit(
            redis,
            f"rate:password-reset:ip:{_digest(client_ip)}",
            settings.PASSWORD_RESET_IP_LIMIT,
            settings.PASSWORD_RESET_WINDOW_SECONDS,
        )
        return email_ok and ip_ok
    except Exception:
        # Production readiness already fails while Redis is unavailable. Do not
        # turn a transient Redis error into an account-recovery outage.
        logger.exception("Password reset rate limiter unavailable")
        return True
