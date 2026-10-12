"""Public legal pages and account tools, served on the API's HTTPS origin."""

from html import escape
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.core.config import settings

router = APIRouter()
PAGE_DIR = Path(__file__).resolve().parents[2] / "public"
HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": (
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; "
        "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    ),
}


def page(name: str) -> HTMLResponse:
    content = (PAGE_DIR / f"{name}.html").read_text(encoding="utf-8")
    contact = (
        f'<a href="mailto:{escape(settings.SUPPORT_EMAIL, quote=True)}">'
        f"{escape(settings.SUPPORT_EMAIL)}</a>"
        if settings.SUPPORT_EMAIL
        else '<a href="https://github.com/Neroadawat/Ginder/issues">Ginder GitHub Issues</a>'
    )
    return HTMLResponse(content.replace("{{CONTACT}}", contact), headers=HEADERS)


@router.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
async def privacy():
    return page("privacy")


@router.get("/terms", response_class=HTMLResponse, include_in_schema=False)
async def terms():
    return page("terms")


@router.get("/delete-account", response_class=HTMLResponse, include_in_schema=False)
async def delete_account():
    return page("delete-account")


@router.get("/reset-password", response_class=HTMLResponse, include_in_schema=False)
async def reset_password():
    return page("reset-password")
