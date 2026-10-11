"""Phase 7 monthly quota, cooldown, and hard-limit behaviour."""

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
    service._increment_backup = AsyncMock(return_value=1)

    first = await service.reserve("nearby_search", "actor-1")
    second = await service.reserve("nearby_search", "actor-2")
    third = await service.reserve("nearby_search", "actor-3")
    blocked = await service.reserve("nearby_search", "actor-4")

    assert first.allowed is True and first.soft_limit_reached is False
    assert second.allowed is True and second.soft_limit_reached is True
    assert third.allowed is True and third.count == 3
    assert blocked.allowed is False and blocked.reason == "hard_limit"
    assert service._increment_backup.await_count == 3


@pytest.mark.asyncio
async def test_same_actor_is_rate_limited_without_incrementing_again(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_SOFT_LIMIT", 5)
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_HARD_LIMIT", 10)
    service = GoogleQuotaService(redis=FakeRedis())
    service._read_db_count = AsyncMock(return_value=0)
    service._increment_backup = AsyncMock(return_value=1)

    first = await service.reserve("nearby_search", "same-actor")
    repeated = await service.reserve("nearby_search", "same-actor")

    assert first.allowed is True
    assert repeated.allowed is False
    assert repeated.reason == "rate_limited"
    assert service._increment_backup.await_count == 1
