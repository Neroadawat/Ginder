"""Tests for parsing live OpenStreetMap fallback responses."""

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.services.osm_fallback_service import OsmFallbackService
from app.utils.geo import generate_cache_key
from app.utils.osm import build_overpass_query, parse_osm_elements


class FakeRedis:
    def __init__(self):
        self.values: dict[str, str] = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None, nx=False):
        if nx and key in self.values:
            return False
        self.values[key] = value
        return True

    async def eval(self, script, key_count, key, token):
        if self.values.get(key) == token:
            del self.values[key]
            return 1
        return 0


def test_query_is_bounded_and_requests_named_eateries():
    query = build_overpass_query(14.0708, 100.6065, 3.4)

    assert "node(around:3400,14.070800,100.606500)" in query
    assert "way(around:3400,14.070800,100.606500)" in query
    assert "relation" not in query
    assert '"amenity"' in query
    assert '["name"]' in query
    assert "out center tags qt" in query


def test_parser_supports_nodes_ways_and_honest_unknown_fields():
    rows = parse_osm_elements(
        [
            {
                "type": "node",
                "id": 10,
                "lat": 14.0,
                "lon": 100.0,
                "tags": {
                    "name": "ร้านข้าว",
                    "amenity": "restaurant",
                    "cuisine": "thai;noodle",
                    "addr:street": "ถนนเชียงราก",
                    "addr:city": "คลองหลวง",
                },
            },
            {
                "type": "way",
                "id": 11,
                "center": {"lat": 14.1, "lon": 100.1},
                "tags": {"name": "Campus Cafe", "amenity": "cafe"},
            },
        ]
    )

    assert len(rows) == 2
    assert rows[0].source_place_id == "node/10"
    assert rows[0].primary_category == "Thai"
    assert rows[0].types[0] == "thai_restaurant"
    assert rows[0].address == "ถนนเชียงราก, คลองหลวง"
    assert rows[1].latitude == 14.1
    assert rows[1].primary_category == "Cafe"


def test_parser_skips_invalid_or_unnamed_elements():
    rows = parse_osm_elements(
        [
            {"type": "node", "id": 1, "lat": 14, "lon": 100, "tags": {}},
            {"type": "node", "id": 2, "tags": {"name": "No coordinates"}},
            {"type": "area", "id": 3, "tags": {"name": "Wrong type"}},
        ]
    )

    assert rows == []


def test_parser_deduplicates_provider_identity():
    element = {
        "type": "node",
        "id": 42,
        "lat": 14.0,
        "lon": 100.0,
        "tags": {"name": "Same", "amenity": "restaurant"},
    }

    assert len(parse_osm_elements([element, element])) == 1


@pytest.mark.asyncio
async def test_area_is_fetched_once_then_shared_by_nearby_users():
    redis = FakeRedis()
    service = OsmFallbackService(redis=redis)
    service._fetch = AsyncMock(return_value=[])
    service._persist = AsyncMock(return_value=0)

    first = await service.ensure_area(13.7450, 100.5330, 0.5)
    second = await service.ensure_area(13.7451, 100.5331, 0.5)

    assert first == 0
    assert second == 0
    service._fetch.assert_awaited_once()
    service._persist.assert_awaited_once()


@pytest.mark.asyncio
async def test_failure_uses_short_marker_and_releases_lock():
    redis = FakeRedis()
    service = OsmFallbackService(redis=redis)
    service._fetch = AsyncMock(side_effect=RuntimeError("provider down"))
    cache_key = generate_cache_key(13.7460, 100.5340, 0.5)

    with pytest.raises(RuntimeError, match="provider down"):
        await service.ensure_area(13.7460, 100.5340, 0.5)

    assert redis.values[f"ginder:restaurant-fallback:ready:{cache_key}"] == "error"
    assert f"ginder:restaurant-fallback:lock:{cache_key}" not in redis.values


@pytest.mark.asyncio
async def test_concurrent_request_waits_for_shared_result():
    redis = FakeRedis()
    service = OsmFallbackService(redis=redis)
    service._fetch = AsyncMock(return_value=[])
    cache_key = generate_cache_key(13.7450, 100.5330, 0.5)
    lock_key = f"ginder:restaurant-fallback:lock:{cache_key}"
    marker_key = f"ginder:restaurant-fallback:ready:{cache_key}"
    redis.values[lock_key] = "another-request"

    async def finish_first_request():
        await asyncio.sleep(0.01)
        redis.values[marker_key] = "20"

    publisher = asyncio.create_task(finish_first_request())
    result = await service.ensure_area(13.7450, 100.5330, 0.5)
    await publisher

    assert result == 0
    service._fetch.assert_not_awaited()
