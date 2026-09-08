"""Firebase Cloud Messaging client (requirement 15.7).

Initialization is lazy and best-effort: Phase 1 deployments (and most local
dev setups) do not have a real ``firebase-credentials.json``, and a missing
file must not crash the app or block session invites (requirement 13.5) —
push is a nice-to-have on top of the in-app notification, not a dependency of
it. If credentials are missing or invalid, ``send_fcm_push`` becomes a no-op
and logs once.
"""

import logging
import threading
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_initialized = False
_available = False


def _ensure_initialized() -> bool:
    """Initialize the firebase-admin app once. Returns whether it is usable."""
    global _initialized, _available

    if _initialized:
        return _available

    with _lock:
        if _initialized:
            return _available

        try:
            import firebase_admin
            from firebase_admin import credentials

            cred = credentials.Certificate(settings.FCM_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
            _available = True
        except Exception:
            logger.warning(
                "FCM credentials not available at %s; push notifications are disabled "
                "for this run (in-app notifications still work).",
                settings.FCM_CREDENTIALS_PATH,
            )
            _available = False
        finally:
            _initialized = True

    return _available


def send_fcm_push(token: str, title: str, body: str, data: dict[str, Any] | None = None) -> None:
    """Send a single push notification. Silently skipped if FCM isn't configured.

    Synchronous by design — the firebase-admin SDK is synchronous, so callers
    from async code should run this via ``asyncio.to_thread``.
    """
    if not _ensure_initialized():
        return

    from firebase_admin import messaging

    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        token=token,
    )
    messaging.send(message)
