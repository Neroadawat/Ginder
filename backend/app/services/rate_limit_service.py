"""Small Redis-backed limits for abuse-prone public endpoints."""

import hashlib
import logging
from collections.abc import Awaitable
from typing import Any, cast

from fastapi import Depends, HTTPException, Request
from redis.asyncio import Redis

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


def _digest(value: str) -> str:
    return hashlib.sha256(value.strip().casefold().encode()).hexdigest()


async def _within_limit(redis: Redis, key: str, limit: int, window_seconds: int) -> bool:
    # INCR and expiry must be atomic: a crash between them must not leave a
    # permanent lockout key. All API workers share the same counters.
    script = """
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return count
    """
    count = await cast(Awaitable[Any], redis.eval(script, 1, key, str(window_seconds)))
    return int(count) <= limit


async def enforce_request_limit(
    redis: Redis, action: str, client_ip: str, limit: int, window_seconds: int = 300
) -> None:
    try:
        allowed = await _within_limit(
            redis, f"rate:{action}:ip:{_digest(client_ip)}", limit, window_seconds
        )
    except Exception:
        logger.error("Abuse protection unavailable")
        raise HTTPException(503, "Temporarily unavailable. Please try again later") from None
    if not allowed:
        raise HTTPException(
            429,
            "Too many requests. Please try again later",
            headers={"Retry-After": str(window_seconds)},
        )


async def limit_auth_requests(request: Request, redis: Redis = Depends(get_redis)) -> None:
    action = request.url.path.rstrip("/").rsplit("/", 1)[-1]
    limits = {"login": 30, "signup": 10, "refresh": 120, "logout": 120, "reset-password": 20}
    if action in limits:
        await enforce_request_limit(
            redis,
            f"auth:{action}",
            request.client.host if request.client else "unknown",
            limits[action],
        )


async def limit_join_requests(request: Request, redis: Redis = Depends(get_redis)) -> None:
    await enforce_request_limit(
        redis, "session-join", request.client.host if request.client else "unknown", 30
    )


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
        # Preserve the generic public response, but never send unlimited email
        # while the shared abuse protection is unavailable.
        logger.error("Password reset rate limiter unavailable")
        return False
