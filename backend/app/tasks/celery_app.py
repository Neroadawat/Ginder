"""Celery application configuration."""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "ginder",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
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
    "cleanup-restaurant-cache-daily": {
        "task": "app.tasks.cleanup.cleanup_restaurant_cache",
        "schedule": crontab(hour=0, minute=0),  # Every midnight UTC
    },
    "cleanup-expired-sessions": {
        "task": "app.tasks.cleanup.cleanup_expired_sessions",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
}

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"])
