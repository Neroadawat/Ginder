"""Account recovery delivery, token replay prevention and public browser routes."""

import smtplib
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.core.exceptions import GinderException
from app.core.security import create_password_reset_token, hash_password, verify_password
from app.main import app
from app.schemas.auth import ResetPasswordRequest
from app.services import email_service
from app.services.auth_service import AuthService


@pytest.mark.asyncio
async def test_email_uses_tls_and_fragment_token(monkeypatch):
    monkeypatch.setattr(email_service.settings, "SMTP_USER", "sender@test.invalid")
    monkeypatch.setattr(email_service.settings, "SMTP_PASSWORD", "smtp-secret")
    monkeypatch.setattr(email_service.settings, "SMTP_SECURITY", "starttls")
    monkeypatch.setattr(email_service.settings, "PUBLIC_BASE_URL", "https://api.test.invalid")
    client = MagicMock()
    client.__enter__.return_value = client
    monkeypatch.setattr(email_service.smtplib, "SMTP", lambda *args, **kwargs: client)
    await email_service.send_password_reset("person@test.invalid", "reset-secret")
    client.starttls.assert_called_once()
    client.login.assert_called_once_with("sender@test.invalid", "smtp-secret")
    message = client.send_message.call_args.args[0]
    assert "/reset-password#token=reset-secret" in message.get_content()


@pytest.mark.asyncio
async def test_email_failure_does_not_log_sensitive_values(monkeypatch, caplog):
    monkeypatch.setattr(email_service.settings, "SMTP_USER", "sender@test.invalid")
    monkeypatch.setattr(email_service.settings, "SMTP_PASSWORD", "smtp-secret")
    monkeypatch.setattr(
        email_service, "_send", MagicMock(side_effect=smtplib.SMTPException("secret"))
    )
    await email_service.send_password_reset("private@test.invalid", "reset-secret")
    assert "delivery failed" in caplog.text
    assert "private@test.invalid" not in caplog.text
    assert "reset-secret" not in caplog.text


@pytest.mark.asyncio
async def test_reset_link_is_invalid_after_password_change():
    user = SimpleNamespace(id="123", hashed_password=hash_password("original-password"))
    token = create_password_reset_token("123", user.hashed_password)
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    service = AuthService(db)
    body = ResetPasswordRequest(token=token, new_password="replacement-password")
    await service.reset_password(body)
    assert verify_password("replacement-password", user.hashed_password)
    with pytest.raises(GinderException, match="Invalid or expired"):
        await service.reset_password(body)


@pytest.mark.asyncio
async def test_public_pages_and_script_work_without_authentication():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        for path in ("privacy", "terms", "delete-account", "reset-password"):
            response = await client.get(f"/{path}")
            assert response.status_code == 200
            assert "{{CONTACT}}" not in response.text
            assert response.headers["referrer-policy"] == "no-referrer"
            assert response.headers["cache-control"] == "no-store"
        script = await client.get("/public/account.js")
        assert script.status_code == 200
        assert "'/users/me'" in script.text
