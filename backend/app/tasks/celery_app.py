"""Celery application configuration."""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "ginder",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.cleanup"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# ─── Periodic Tasks (Beat Schedule) ───
celery_app.conf.beat_schedule = {
    # Expire TTL-backed cache rows at the end of each day (requirement 15.2).
    # Permanent mock data is untouched.
    "cleanup-restaurant-cache-daily": {
        "task": "app.tasks.cleanup.cleanup_restaurant_cache",
        "schedule": crontab(hour=0, minute=0),
    },
    # Frequent, because a session's countdown is authoritative server-side and
    # must still resolve when every client has dropped off.
    "resolve-expired-sessions": {
        "task": "app.tasks.cleanup.resolve_expired_sessions",
        "schedule": crontab(minute="*"),
    },
}
