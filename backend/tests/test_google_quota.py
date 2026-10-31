"""Phase 7 monthly quota, cooldown, and hard-limit behaviour."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.core.config import settings
from app.services.quota_service import GoogleQuotaService


class FakeRedis:
    def __init__(self):
        self.values: dict[str, str] = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, *, ex=None, nx=False):
        if nx and key in self.values:
            return False
        self.values[key] = str(value)
        return True

    async def eval(self, _script, _keys, key, hard_limit, _ttl):
        current = int(self.values.get(key, "0"))
        if current >= int(hard_limit):
            return -1
        current += 1
        self.values[key] = str(current)
        return current


@pytest.mark.asyncio
async def test_soft_limit_warns_and_hard_limit_stops_before_call(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_SOFT_LIMIT", 2)
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_HARD_LIMIT", 3)
    service = GoogleQuotaService(redis=FakeRedis())
    service._read_db_count = AsyncMock(return_value=0)
    service._reserve_monthly = AsyncMock(side_effect=[1, 2, 3, None])

    first = await service.reserve("nearby_search", "actor-1")
    second = await service.reserve("nearby_search", "actor-2")
    third = await service.reserve("nearby_search", "actor-3")
    blocked = await service.reserve("nearby_search", "actor-4")

    assert first.allowed is True and first.soft_limit_reached is False
    assert second.allowed is True and second.soft_limit_reached is True
    assert third.allowed is True and third.count == 3
    assert blocked.allowed is False and blocked.reason == "hard_limit"
    assert service._reserve_monthly.await_count == 4
    service._reserve_monthly.assert_awaited_with("nearby_search", 3)


@pytest.mark.asyncio
async def test_same_actor_is_rate_limited_without_incrementing_again(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_SOFT_LIMIT", 5)
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_HARD_LIMIT", 10)
    service = GoogleQuotaService(redis=FakeRedis())
    service._read_db_count = AsyncMock(return_value=0)
    service._reserve_monthly = AsyncMock(return_value=1)

    first = await service.reserve("nearby_search", "same-actor")
    repeated = await service.reserve("nearby_search", "same-actor")

    assert first.allowed is True
    assert repeated.allowed is False
    assert repeated.reason == "rate_limited"
    assert service._reserve_monthly.await_count == 1


@pytest.mark.asyncio
async def test_photo_reservations_disabled_even_with_old_environment(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_PHOTO_SOFT_LIMIT", 800)
    monkeypatch.setattr(settings, "GOOGLE_PHOTO_HARD_LIMIT", 1000)
    service = GoogleQuotaService(redis=FakeRedis())
    service._reserve_monthly = AsyncMock()
    result = await service.reserve("place_photo", "actor", request_key="old-photo")
    assert result.allowed is False
    assert result.reason == "hard_limit"
    assert service._limits("place_photo") == (0, 0)
    service._reserve_monthly.assert_not_awaited()


@pytest.mark.asyncio
async def test_redis_outage_blocks_google_without_reserving() -> None:
    redis = FakeRedis()
    redis.set = AsyncMock(side_effect=ConnectionError("redis offline"))
    service = GoogleQuotaService(redis=redis)
    service._reserve_monthly = AsyncMock()
    result = await service.reserve("nearby_search", "actor")
    assert result.allowed is False
    assert result.reason == "unavailable"
    service._reserve_monthly.assert_not_awaited()


@pytest.mark.asyncio
async def test_database_outage_blocks_google() -> None:
    service = GoogleQuotaService(redis=FakeRedis())
    service._reserve_monthly = AsyncMock(side_effect=ConnectionError("database offline"))
    result = await service.reserve("nearby_search", "actor")
    assert result.allowed is False
    assert result.reason == "unavailable"


@pytest.mark.asyncio
async def test_redis_restart_does_not_reset_durable_limit(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_HARD_LIMIT", 3)
    redis = FakeRedis()
    service = GoogleQuotaService(redis=redis)
    service._reserve_monthly = AsyncMock(side_effect=[3, None])
    assert (await service.reserve("nearby_search", "actor")).allowed is True
    redis.values.clear()
    assert (await service.reserve("nearby_search", "actor")).allowed is False


@pytest.mark.parametrize(
    ("moment", "period"),
    [
        (datetime(2026, 11, 1, 6, 59, tzinfo=UTC), "2026-10"),
        (datetime(2026, 11, 1, 7, 0, tzinfo=UTC), "2026-11"),
        (datetime(2026, 12, 1, 7, 59, tzinfo=UTC), "2026-11"),
        (datetime(2026, 12, 1, 8, 0, tzinfo=UTC), "2026-12"),
    ],
)
def test_billing_month_uses_pacific_time_with_dst(moment, period) -> None:
    assert GoogleQuotaService._period(moment) == period
