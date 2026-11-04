"""Exercise Google party identity, concurrency and voting on isolated PostgreSQL."""

import asyncio
import os
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.exceptions import ForbiddenException, SessionAlreadyStartedException
from app.models.external_api_usage import ExternalApiUsage
from app.models.restaurant import Restaurant
from app.models.session import Session, SessionParticipant
from app.models.user import User
from app.schemas.vote import SwipeRequest
from app.services.google_places_service import GooglePlacesService, GoogleSearchResult
from app.services.quota_service import GoogleQuotaService
from app.services.restaurant_service import RestaurantService
from app.services.session_service import SessionService
from app.services.vote_service import VoteService
from app.websocket.connection_manager import manager
from tests.admin_support import test_database
from tests.test_google_places import TU_LAT, TU_LNG
from tests.test_google_preview_photos import places
from tests.test_google_quota import FakeRedis


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("ADMIN_TEST_POSTGRES_URL"), reason="requires isolated PostgreSQL"
)
async def test_five_party_members_share_one_google_search_and_can_vote(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_PLACES_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_PLACES_API_KEY", "fake-key")
    monkeypatch.setattr(RestaurantService, "_search", AsyncMock(return_value=[]))
    cards = [
        GooglePlacesService._to_card(place, latitude=TU_LAT, longitude=TU_LNG, category=None)
        for place in places()
    ]
    assert all(card is not None for card in cards)
    search = AsyncMock(return_value=GoogleSearchResult(cards, "available"))
    monkeypatch.setattr(GooglePlacesService, "search_nearby", search)
    photos = AsyncMock(return_value=False)
    monkeypatch.setattr(GooglePlacesService, "add_preview_photos", photos)
    recover = AsyncMock(side_effect=lambda references, **_: references)
    monkeypatch.setattr(GooglePlacesService, "recover_session_cards", recover)
    broadcast = AsyncMock()
    monkeypatch.setattr(manager, "broadcast_to_session", broadcast)

    engine, sessions = await test_database()
    try:
        async with sessions() as db:
            users = [
                User(email=f"party-{index}@example.test", display_name=f"P{index}",
                     hashed_password="unused")
                for index in range(5)
            ]
            db.add_all(users)
            await db.flush()
            room = Session(host_id=users[0].id, latitude=TU_LAT, longitude=TU_LNG,
                           radius_km=1.5, duration_seconds=300, invite_code="PHOTOS")
            db.add(room)
            await db.flush()
            db.add_all([SessionParticipant(session_id=room.id, user_id=user.id) for user in users])
            await db.commit()

        async def start(user):
            async with sessions() as db:
                return await SessionService(db).start_session(room.id, user)

        with pytest.raises(ForbiddenException):
            await start(users[1])
        search.assert_not_awaited()
        outcomes = await asyncio.gather(start(users[0]), start(users[0]), return_exceptions=True)
        assert sum(isinstance(item, SessionAlreadyStartedException) for item in outcomes) == 1
        started = next(item for item in outcomes if not isinstance(item, BaseException))
        assert started.deck.total == 20
        search.assert_awaited_once()
        assert search.await_args.kwargs["latitude"] == TU_LAT
        assert search.await_args.kwargs["longitude"] == TU_LNG
        photos.assert_awaited_once()
        assert len(broadcast.await_args.args[2]["deck"]["restaurants"]) == 20
        expected = [card.id for card in started.deck.restaurants]

        for index, user in enumerate(users):
            async with sessions() as db:
                deck = await SessionService(db).get_deck(room.id, user)
                assert [card.id for card in deck.restaurants] == expected
                assert all(card.can_like for card in deck.restaurants)
                vote = await VoteService(db).record_swipe(
                    room.id, user, SwipeRequest(restaurant_id=expected[0], liked=True)
                )
                assert vote.unanimous_match is (index == 4)
                await db.commit()

        async with sessions() as db:
            identities = (await db.scalars(select(Restaurant))).all()
            assert len(identities) == 20
            assert all(
                row.name == "Google Maps restaurant" and row.photo_url is None
                and row.address is None and row.latitude == row.longitude == 0
                for row in identities
            )
        search.assert_awaited_once()
        photos.assert_awaited_once()
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("ADMIN_TEST_POSTGRES_URL"), reason="requires isolated PostgreSQL"
)
async def test_monthly_search_and_photo_caps_are_enforced_concurrently(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_PLACES_PHOTOS_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_NEARBY_HARD_LIMIT", 150)
    monkeypatch.setattr(settings, "GOOGLE_PHOTO_HARD_LIMIT", 750)
    engine, sessions = await test_database()
    try:
        service = GoogleQuotaService(redis=FakeRedis(), db_factory=sessions)
        async with sessions() as db:
            db.add_all([
                ExternalApiUsage(period=service._period(), provider="google",
                                 operation="nearby_search", count=149),
                ExternalApiUsage(period=service._period(), provider="google",
                                 operation="place_photo", count=749),
            ])
            await db.commit()

        decisions = await asyncio.gather(
            service.reserve("nearby_search", "host-a"),
            service.reserve("nearby_search", "host-b"),
            service.reserve("place_photo", "host-a", "photo-a"),
            service.reserve("place_photo", "host-b", "photo-b"),
        )
        assert sum(decision.allowed for decision in decisions[:2]) == 1
        assert sum(decision.allowed for decision in decisions[2:]) == 1
        usage = await service.get_google_usage()
        assert usage.nearby_search.count == 150
        assert usage.place_photo.count == 750
    finally:
        await engine.dispose()
