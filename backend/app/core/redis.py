"""Redis client for caching and pub/sub."""

import redis.asyncio as redis

from app.core.config import settings

redis_client = redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
)


async def get_redis() -> redis.Redis:
    """Get the Redis client instance."""
    return redis_client
