"""On-demand OSM restaurant discovery for areas outside the seeded campus."""

import asyncio
import logging
import math
from collections.abc import Awaitable
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4

import httpx
from redis.asyncio import Redis
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.redis import redis_client
from app.models.restaurant import Restaurant
from app.utils.geo import external_search_area, generate_cache_key
from app.utils.osm import OsmRestaurant, build_overpass_query, parse_osm_elements

logger = logging.getLogger(__name__)

_CACHE_PREFIX = "ginder:restaurant-fallback"
_LOCK_GRACE_SECONDS = 10
_ERROR_RETRY_SECONDS = 60


class OsmFallbackService:
    """Fetch one shared grid cell from Overpass and persist a TTL cache."""

    def __init__(self, redis: Redis | None = None):
        self.redis = redis or redis_client

    async def ensure_area(self, latitude: float, longitude: float, radius_km: float) -> int:
        """Ensure a nearby cell has been fetched, returning imported row count.

        Redis is only an optimisation. If it is unavailable the database cache
        and its uniqueness constraints still keep the operation safe.
        """
        cache_key = generate_cache_key(latitude, longitude, radius_km)
        marker_key = f"{_CACHE_PREFIX}:ready:{cache_key}"
        if await self._get(marker_key) is not None:
            return 0

        lock_key = f"{_CACHE_PREFIX}:lock:{cache_key}"
        lock_token = await self._acquire_lock(lock_key)
        if lock_token is None:
            # Another request is filling this cell. Wait briefly for its marker
            # instead of sending a duplicate public Overpass query.
            wait_iterations = max(
                1,
                math.ceil(settings.RESTAURANT_FALLBACK_TIMEOUT_SECONDS / 0.2),
            )
            for _ in range(wait_iterations):
                await asyncio.sleep(0.2)
                if await self._get(marker_key) is not None:
                    return 0
            return 0

        try:
            # Re-check after taking the lock in case another request completed
            # between the first marker lookup and lock acquisition.
            if await self._get(marker_key) is not None:
                return 0

            centre_lat, centre_lng, fetch_radius = external_search_area(
                latitude, longitude, radius_km
            )
            rows = await self._fetch(centre_lat, centre_lng, fetch_radius)
            imported = await self._persist(rows, cache_key)
            await self._set(
                marker_key,
                str(len(rows)),
                settings.RESTAURANT_FALLBACK_CACHE_HOURS * 3600,
            )
            logger.info(
                "OSM fallback cached %s venue(s) for %s (%s changed)",
                len(rows),
                cache_key,
                imported,
            )
            return imported
        except Exception:
            # A short failure marker prevents a busy outage from hammering the
            # public endpoint while still allowing an automatic retry soon.
            await self._set(marker_key, "error", _ERROR_RETRY_SECONDS)
            raise
        finally:
            await self._release_lock(lock_key, lock_token)

    async def _fetch(
        self, latitude: float, longitude: float, radius_km: float
    ) -> list[OsmRestaurant]:
        query = build_overpass_query(latitude, longitude, radius_km)
        endpoints = (
            settings.OSM_OVERPASS_PRIMARY_URL,
            settings.OSM_OVERPASS_SECONDARY_URL,
            settings.OSM_OVERPASS_TERTIARY_URL,
        )
        last_error: Exception | None = None
        unique_endpoints = tuple(dict.fromkeys(endpoints))
        total_timeout = settings.RESTAURANT_FALLBACK_TIMEOUT_SECONDS
        deadline = asyncio.get_running_loop().time() + total_timeout

        async with httpx.AsyncClient(
            headers={
                "User-Agent": "Ginder/0.1 (+https://github.com/Neroadawat/Ginder)",
                "Accept": "application/json",
            },
        ) as client:
            for endpoint in unique_endpoints:
                remaining = deadline - asyncio.get_running_loop().time()
                if remaining < 1.0:
                    break
                try:
                    response = await client.post(
                        endpoint,
                        data={"data": query},
                        timeout=httpx.Timeout(min(20.0, remaining)),
                    )
                    response.raise_for_status()
                    payload = response.json()
                    elements = payload.get("elements", [])
                    if not isinstance(elements, list):
                        raise ValueError("Overpass response has no elements list")
                    return parse_osm_elements(elements)
                except (httpx.HTTPError, ValueError) as exc:
                    last_error = exc
                    logger.warning("OSM fallback endpoint failed: %s (%s)", endpoint, exc)

        raise RuntimeError("All configured OSM fallback endpoints failed") from last_error

    @staticmethod
    async def _persist(rows: list[OsmRestaurant], cache_key: str) -> int:
        if not rows:
            return 0

        now = datetime.now(UTC)
        expires_at = now + timedelta(hours=settings.RESTAURANT_FALLBACK_CACHE_HOURS)
        values = [
            {
                "place_id": f"osm:{row.source_place_id}",
                "source": "osm",
                "source_place_id": row.source_place_id,
                "name": row.name,
                "latitude": row.latitude,
                "longitude": row.longitude,
                "address": row.address,
                "types": row.types,
                "primary_category": row.primary_category,
                "price_level": None,
                "rating": None,
                "user_ratings_total": None,
                "opening_hours": None,
                "photo_url": None,
                "photo_source": None,
                "photo_attribution": None,
                "google_maps_url": (
                    "https://www.google.com/maps/dir/?api=1"
                    f"&destination={row.latitude},{row.longitude}"
                ),
                "verified_at": now,
                "is_permanent": False,
                "expires_at": expires_at,
                "cache_key": cache_key,
                "created_at": now,
                "updated_at": now,
            }
            for row in rows
        ]

        statement = insert(Restaurant).values(values)
        excluded = statement.excluded
        statement = statement.on_conflict_do_update(
            constraint="uq_restaurants_source_place_id",
            set_={
                "name": excluded.name,
                "latitude": excluded.latitude,
                "longitude": excluded.longitude,
                "address": excluded.address,
                "types": excluded.types,
                "primary_category": excluded.primary_category,
                "google_maps_url": excluded.google_maps_url,
                "verified_at": excluded.verified_at,
                "expires_at": excluded.expires_at,
                "cache_key": excluded.cache_key,
                "updated_at": excluded.updated_at,
            },
            where=Restaurant.is_permanent.is_(False),
        )

        async with async_session_factory() as db:
            result = await db.execute(statement)
            await db.commit()
        return result.rowcount or 0

    async def _get(self, key: str) -> str | None:
        try:
            return await self.redis.get(key)
        except Exception:
            logger.warning("Redis unavailable while reading OSM fallback cache", exc_info=True)
            return None

    async def _set(self, key: str, value: str, ttl_seconds: int) -> None:
        try:
            await self.redis.set(key, value, ex=max(1, ttl_seconds))
        except Exception:
            logger.warning("Redis unavailable while writing OSM fallback cache", exc_info=True)

    async def _acquire_lock(self, key: str) -> str | None:
        token = uuid4().hex
        try:
            lock_seconds = max(
                30,
                math.ceil(settings.RESTAURANT_FALLBACK_TIMEOUT_SECONDS) + _LOCK_GRACE_SECONDS,
            )
            acquired = await self.redis.set(key, token, ex=lock_seconds, nx=True)
            return token if acquired else None
        except Exception:
            logger.warning("Redis unavailable; proceeding without fallback lock", exc_info=True)
            # Empty string means "proceed, but there is no Redis lock to release".
            return ""

    async def _release_lock(self, key: str, token: str) -> None:
        if not token:
            return
        script = (
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
            "return redis.call('del', KEYS[1]) else return 0 end"
        )
        try:
            await cast(Awaitable[Any], self.redis.eval(script, 1, key, token))
        except Exception:
            logger.warning("Redis unavailable while releasing fallback lock", exc_info=True)
