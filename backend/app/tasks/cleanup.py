"""Cleanup tasks — cache purge, expired session resolution."""


from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.cleanup.cleanup_restaurant_cache")
def cleanup_restaurant_cache():
    """Delete all cached restaurant data (runs daily at midnight).

    This implements the requirement: 'Cronjob ล้างข้อมูล Cache ร้านอาหารทุกสิ้นวัน'
    """
    # TODO: Implement with synchronous DB session
    # from app.core.database import sync_session_factory
    # with sync_session_factory() as session:
    #     session.execute(delete(Restaurant))
    #     session.commit()
    pass


@celery_app.task(name="app.tasks.cleanup.cleanup_expired_sessions")
def cleanup_expired_sessions():
    """Find and resolve sessions that have exceeded their timer.

    This handles:
    - Timer expiry → resolve via majority vote / spin wheel
    - Early termination detection
    """
    # TODO: Implement session resolution for expired sessions
    # 1. Query sessions where status=ACTIVE and ends_at < now
    # 2. For each, call MatchService.resolve_session()
    # 3. Broadcast result via WebSocket (or via Redis Pub/Sub)
    pass
