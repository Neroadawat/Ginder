"""Bound multipart uploads before parsing and apply browser security headers."""

import re

from starlette.responses import JSONResponse

from app.core.config import settings

PHOTO_PATH = re.compile(r"^/admin/api/restaurants/[0-9a-fA-F-]{36}/photo$")


class AdminBoundaryMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not (
            scope["path"] == "/admin" or scope["path"].startswith("/admin/")
        ):
            return await self.app(scope, receive, send)

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).extend(
                    [
                        (b"cache-control", b"no-store"),
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"DENY"),
                        (b"referrer-policy", b"no-referrer"),
                        (
                            b"content-security-policy",
                            (
                                b"default-src 'none'; script-src 'self'; style-src 'self'; "
                                b"img-src 'self' blob: data: https:; connect-src 'self'; "
                                b"form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
                            ),
                        ),
                    ]
                )
            await send(message)

        if not settings.ADMIN_ENABLED:
            return await JSONResponse({"detail": "Not found"}, status_code=404)(
                scope, receive, secure_send
            )
        if scope["method"] in {"POST", "PATCH", "DELETE", "PUT"}:
            limit = 6 * 1024 * 1024 if PHOTO_PATH.fullmatch(scope["path"]) else 64 * 1024
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > limit:
                    return await JSONResponse({"detail": "Request is too large"}, status_code=413)(
                        scope, receive, secure_send
                    )
                if not message.get("more_body", False):
                    break
            delivered = False

            async def bounded_receive():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            return await self.app(scope, bounded_receive, secure_send)
        return await self.app(scope, receive, secure_send)
