"""Durable monthly reservations with Redis request throttling."""

import hashlib
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal
from zoneinfo import ZoneInfo

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.redis import redis_client
from app.models.external_api_usage import ExternalApiUsage
from app.schemas.usage import GoogleUsageResponse, OperationUsageResponse

logger = logging.getLogger(__name__)

QuotaOperation = Literal["nearby_search", "place_photo"]
_COOLDOWN_PREFIX = "ginder:google-cooldown"


@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    count: int
    soft_limit_reached: bool
    reason: Literal["allowed", "rate_limited", "hard_limit", "unavailable"]


class GoogleQuotaService:
    def __init__(self, redis: Redis | None = None, db_factory=async_session_factory):
        self.redis = redis or redis_client
        self.db_factory = db_factory

    async def reserve(
        self,
        operation: QuotaOperation,
        actor_key: str,
        request_key: str | None = None,
    ) -> QuotaDecision:
        """Reserve one billable call before sending it to Google."""
        soft_limit, hard_limit = self._limits(operation)
        if hard_limit <= 0:
            return QuotaDecision(False, 0, True, "hard_limit")

        try:
            # Search cooldowns apply across all filters for one account.
            # The resource discriminator remains for legacy quota callers.
            cooldown_subject = actor_key
            if request_key:
                request_hash = hashlib.sha256(request_key.encode()).hexdigest()[:16]
                cooldown_subject = f"{actor_key}:{request_hash}"
            cooldown_key = f"{_COOLDOWN_PREFIX}:{operation}:{cooldown_subject}"
            cooldown_set = await self.redis.set(
                cooldown_key,
                "1",
                ex=max(1, settings.GOOGLE_USER_COOLDOWN_SECONDS),
                nx=True,
            )
            if not cooldown_set:
                return QuotaDecision(
                    False,
                    await self._read_count(operation),
                    False,
                    "rate_limited",
                )

            # PostgreSQL is the durable authority for every reservation. A lost
            # Redis key must never reset the monthly allowance.
            count = await self._reserve_monthly(operation, hard_limit)
            if count is None:
                return QuotaDecision(False, hard_limit, True, "hard_limit")
            return QuotaDecision(True, count, count >= soft_limit, "allowed")
        except Exception:
            # Without both throttling and durable accounting, use local data.
            logger.warning("Google quota unavailable; external call blocked", exc_info=True)
            return QuotaDecision(False, 0, False, "unavailable")

    async def get_google_usage(self) -> GoogleUsageResponse:
        period = self._period()
        nearby_count = await self._read_count("nearby_search")
        photo_count = await self._read_count("place_photo")
        return GoogleUsageResponse(
            period=period,
            enabled=settings.GOOGLE_PLACES_ENABLED and bool(settings.GOOGLE_PLACES_API_KEY),
            nearby_search=self._usage_response("nearby_search", nearby_count),
            place_photo=self._usage_response("place_photo", photo_count),
        )

    async def _read_count(self, operation: QuotaOperation) -> int:
        return await self._read_db_count(operation)

    async def _read_db_count(self, operation: QuotaOperation) -> int:
        period = self._period()
        try:
            async with self.db_factory() as db:
                value = await db.scalar(
                    select(ExternalApiUsage.count).where(
                        ExternalApiUsage.period == period,
                        ExternalApiUsage.provider == "google",
                        ExternalApiUsage.operation == operation,
                    )
                )
                return int(value or 0)
        except Exception:
            logger.exception("PostgreSQL quota read failed")
            return 0

    async def _reserve_monthly(self, operation: QuotaOperation, hard_limit: int) -> int | None:
        now = datetime.now(UTC)
        update = {
            "count": ExternalApiUsage.count + 1,
            "updated_at": now,
        }
        statement = (
            insert(ExternalApiUsage)
            .values(
                period=self._period(now),
                provider="google",
                operation=operation,
                count=1,
                updated_at=now,
            )
            .on_conflict_do_update(
                constraint="uq_external_api_usage_period_operation",
                set_=update,
                where=ExternalApiUsage.count < hard_limit,
            )
            .returning(ExternalApiUsage.count)
        )

        async with self.db_factory() as db:
            count = await db.scalar(statement)
            await db.commit()
            return int(count) if count is not None else None

    @staticmethod
    def _period(moment: datetime | None = None) -> str:
        # Google resets monthly free usage at midnight Pacific US time,
        # including daylight saving changes, rather than at midnight UTC.
        pacific = (moment or datetime.now(UTC)).astimezone(ZoneInfo("America/Los_Angeles"))
        return pacific.strftime("%Y-%m")

    @staticmethod
    def _limits(operation: QuotaOperation) -> tuple[int, int]:
        if operation == "nearby_search":
            return settings.GOOGLE_NEARBY_SOFT_LIMIT, settings.GOOGLE_NEARBY_HARD_LIMIT
        # Old environment values must not re-enable photo reservations.
        return 0, 0

    @classmethod
    def _usage_response(
        cls, operation: QuotaOperation, count: int
    ) -> OperationUsageResponse:
        soft_limit, hard_limit = cls._limits(operation)
        return OperationUsageResponse(
            operation=operation,
            count=count,
            soft_limit=soft_limit,
            hard_limit=hard_limit,
            soft_limit_reached=count >= soft_limit,
            hard_limit_reached=count >= hard_limit,
        )
