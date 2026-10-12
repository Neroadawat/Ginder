"""Deliver transactional email without blocking the API event loop."""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import quote

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send(message: EmailMessage) -> None:
    context = ssl.create_default_context()
    if settings.SMTP_SECURITY == "ssl":
        client = smtplib.SMTP_SSL(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
            context=context,
        )
    else:
        client = smtplib.SMTP(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS
        )
    with client:
        if settings.SMTP_SECURITY == "starttls":
            client.starttls(context=context)
        client.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        client.send_message(message)


async def send_password_reset(email: str, token: str) -> None:
    # A fragment is never sent to the web server or included in access logs.
    url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/reset-password#token={quote(token, safe='')}"
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.error("Password reset email unavailable: SMTP credentials are missing")
        return
    message = EmailMessage()
    message["Subject"] = "ตั้งรหัสผ่านใหม่สำหรับ Ginder / Reset your Ginder password"
    message["From"] = settings.EMAIL_FROM
    message["To"] = email
    message.set_content(
        "เปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ภายใน 15 นาที:\n"
        f"{url}\n\nหากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ให้ข้ามอีเมลนี้ได้\n\n"
        "Open this link within 15 minutes to reset your password. "
        "If you did not request this, ignore this email."
    )
    try:
        await asyncio.to_thread(_send, message)
    except (OSError, smtplib.SMTPException):
        # Do not log recipients, tokens, SMTP responses or credential-bearing URLs.
        logger.error("Password reset email delivery failed")
