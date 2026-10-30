"""Opaque, revocable browser cookies; CSRF protection independent of mobile JWTs."""

import hashlib
import hmac
from datetime import UTC, datetime
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db
from app.models.admin import AdminSession
from app.models.user import User

COOKIE = "ginder_admin"


def require_admin_enabled() -> None:
    if not settings.ADMIN_ENABLED:
        raise HTTPException(404, "Not found")


def session_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_token(token: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), f"admin-csrf:{token}".encode(), "sha256"
    ).hexdigest()


def check_origin(request: Request) -> None:
    origin = request.headers.get("origin", "")
    public = urlsplit(settings.PUBLIC_BASE_URL)
    expected = f"{public.scheme}://{public.netloc}"
    if origin != expected or request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Open Admin from its configured address")


async def get_admin(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    require_admin_enabled()
    token = request.cookies.get(COOKIE, "")
    if not 32 <= len(token) <= 128:
        raise HTTPException(401, "Please sign in to Admin")
    record = await db.get(AdminSession, session_hash(token))
    now = datetime.now(UTC)
    if record is None or record.expires_at.replace(tzinfo=UTC) <= now:
        raise HTTPException(401, "Admin session expired")
    user = await db.get(User, record.user_id)
    if (
        user is None
        or not user.is_active
        or not user.is_admin
        or user.token_version != record.token_version
    ):
        raise HTTPException(403, "Administrator access required")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        check_origin(request)
        if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), csrf_token(token)):
            raise HTTPException(403, "Refresh Admin and try again")
    return user
