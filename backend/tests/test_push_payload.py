import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core import fcm
from app.models.notification import NotificationType
from app.services.notification_service import NotificationService


@pytest.mark.asyncio
async def test_push_payload_identifies_recipient_without_credentials(monkeypatch):
    send = MagicMock()
    monkeypatch.setattr(fcm, "send_fcm_push", send)
    notification = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        type=NotificationType.SESSION_INVITE,
        title="Session Invite",
        body="Test invitation",
        data=json.dumps({"session_id": str(uuid.uuid4()), "invite_code": "test"}),
    )
    await NotificationService(AsyncMock())._send_fcm_push("test-device-token", notification)
    payload = send.call_args.kwargs["data"]
    assert payload["recipient_id"] == str(notification.user_id)
    assert payload["notification_id"] == str(notification.id)
    assert payload["type"] == "session_invite"
    assert payload["payload"] == notification.data
