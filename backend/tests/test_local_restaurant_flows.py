"""Phase 5/6 coverage for real local Solo and Group restaurant flows."""

import csv
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.config import settings
from app.models.match_result import ResolutionType
from app.models.restaurant import Restaurant
from app.models.session import SessionStatus
from app.schemas.restaurant import SoloFilterRequest
from app.schemas.vote import SwipeRequest
from app.services.match_service import MatchService
from app.services.osm_fallback_service import OsmFallbackService
from app.services.restaurant_service import RestaurantService
from app.services.vote_service import VoteService
from app.utils.geo import calculate_distance_km

TU_LAT = 14.0708
TU_LNG = 100.6065
CURATED_CSV = (
    Path(__file__).resolve().parents[1] / "data" / "thammasat_rangsit_restaurants.csv"
)


def restaurant(
    *,
    latitude: float = TU_LAT,
    longitude: float = TU_LNG,
    source: str = "osm",
) -> Restaurant:
    restaurant_id = uuid.uuid4()
    return Restaurant(
        id=restaurant_id,
        place_id=f"{source}:{restaurant_id}",
        source=source,
        source_place_id=str(restaurant_id),
        name=f"Local {source} restaurant",
        latitude=latitude,
        longitude=longitude,
        types=["restaurant"],
        primary_category="Thai",
        is_permanent=True,
        expires_at=None,
    )


class ListResult:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class SingleResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDb:
    def __init__(self, results=()):
        self.results = list(results)
        self.added = []
        self.executed = []

    async def execute(self, statement):
        self.executed.append(statement)
        return self.results.pop(0) if self.results else None

    async def scalar(self, _statement):
        return self.scalar_value

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        return None


def test_curated_thammasat_dataset_supports_a_google_free_deck() -> None:
    with CURATED_CSV.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    assert len(rows) >= 40
    assert len({row["place_id"] for row in rows}) == len(rows)
    assert all(row["place_id"].startswith(("osm:", "manual:")) for row in rows)
    assert all(
        calculate_distance_km(
            TU_LAT,
            TU_LNG,
            float(row["latitude"]),
            float(row["longitude"]),
        )
        <= settings.MAX_RADIUS_KM + 0.01
        for row in rows
    )


@pytest.mark.asyncio
async def test_radius_search_keeps_inside_restaurant_and_drops_outside() -> None:
    inside = restaurant(latitude=TU_LAT + 0.004)
    outside = restaurant(latitude=TU_LAT + 0.018)
    service = RestaurantService(FakeDb([ListResult([inside, outside])]))

    found = await service._execute_radius_query(None, TU_LAT, TU_LNG, 1.0)

    assert found == [inside]


@pytest.mark.asyncio
async def test_solo_distance_uses_the_requesting_users_gps(monkeypatch) -> None:
    venue = restaurant(latitude=TU_LAT + 0.004)
    db = FakeDb([ListResult([])])  # No previous solo swipes.
    service = RestaurantService(db)
    monkeypatch.setattr(service, "_search", AsyncMock(return_value=[venue]))
    filters = SoloFilterRequest(latitude=TU_LAT, longitude=TU_LNG, radius_km=1.0)

    deck = await service.get_solo_deck(filters, SimpleNamespace(id=uuid.uuid4()))

    expected = round(calculate_distance_km(TU_LAT, TU_LNG, venue.latitude, venue.longitude), 2)
    assert deck.restaurants[0].distance_km == expected


@pytest.mark.asyncio
async def test_group_distance_uses_host_location_and_preserves_deck_order() -> None:
    first = restaurant(latitude=TU_LAT + 0.003)
    second = restaurant(latitude=TU_LAT + 0.006, source="manual")
    entries = [SimpleNamespace(restaurant=first), SimpleNamespace(restaurant=second)]
    service = RestaurantService(FakeDb([ListResult(entries)]))
    session = SimpleNamespace(
        id=uuid.uuid4(), latitude=TU_LAT, longitude=TU_LNG, radius_km=1.5
    )

    deck = await service.get_session_deck(session)

    assert [card.id for card in deck.restaurants] == [first.id, second.id]
    assert deck.restaurants[0].distance_km == round(
        calculate_distance_km(TU_LAT, TU_LNG, first.latitude, first.longitude), 2
    )


@pytest.mark.asyncio
async def test_sufficient_local_results_do_not_call_external_fallback(monkeypatch) -> None:
    venues = [restaurant(latitude=TU_LAT + index * 0.0001) for index in range(10)]
    service = RestaurantService(FakeDb([ListResult(venues)]))
    fallback = AsyncMock()
    monkeypatch.setattr(OsmFallbackService, "ensure_area", fallback)

    found = await service._search(TU_LAT, TU_LNG, 1.5)

    assert found == venues
    fallback.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_provider_mode_returns_empty_without_external_request(monkeypatch) -> None:
    service = RestaurantService(FakeDb([ListResult([])]))
    fallback = AsyncMock()
    monkeypatch.setattr(settings, "RESTAURANT_FALLBACK_PROVIDER", "none")
    monkeypatch.setattr(OsmFallbackService, "ensure_area", fallback)

    assert await service._search(TU_LAT, TU_LNG, 3.0) == []
    fallback.assert_not_awaited()


@pytest.mark.asyncio
async def test_group_does_not_create_a_deck_below_local_minimum(monkeypatch) -> None:
    venues = [restaurant() for _ in range(settings.MIN_LOCAL_RESTAURANTS - 1)]
    db = FakeDb()
    service = RestaurantService(db)
    monkeypatch.setattr(service, "_search", AsyncMock(return_value=venues))
    session = SimpleNamespace(
        id=uuid.uuid4(),
        latitude=TU_LAT,
        longitude=TU_LNG,
        radius_km=1.5,
        category_filter=None,
        price_filter=None,
        rating_filter=None,
        open_now_filter=False,
    )

    assert await service.create_session_deck(session) == []
    assert db.added == []


@pytest.mark.asyncio
async def test_group_persists_one_shared_deck_capped_at_twenty(monkeypatch) -> None:
    venues = [restaurant(latitude=TU_LAT + index * 0.00001) for index in range(25)]
    db = FakeDb()
    service = RestaurantService(db)
    monkeypatch.setattr(service, "_search", AsyncMock(return_value=venues))
    monkeypatch.setattr("app.services.restaurant_service.random.shuffle", lambda _items: None)
    session = SimpleNamespace(
        id=uuid.uuid4(),
        latitude=TU_LAT,
        longitude=TU_LNG,
        radius_km=1.5,
        category_filter=None,
        price_filter=None,
        rating_filter=None,
        open_now_filter=False,
    )

    deck = await service.create_session_deck(session)

    assert deck == venues[: settings.MAX_DECK_SIZE]
    assert [entry.restaurant_id for entry in db.added] == [item.id for item in deck]
    assert [entry.position for entry in db.added] == list(range(settings.MAX_DECK_SIZE))


@pytest.mark.asyncio
@pytest.mark.parametrize("source", ["osm", "manual"])
async def test_local_restaurant_can_be_saved_as_a_solo_like(source: str) -> None:
    venue = restaurant(source=source)
    db = FakeDb()
    db.scalar_value = venue.id
    response = await VoteService(db).record_solo_swipe(
        SimpleNamespace(id=uuid.uuid4()),
        SwipeRequest(restaurant_id=venue.id, liked=True),
    )

    assert response.success is True
    assert len(db.executed) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("source", ["osm", "manual"])
async def test_local_restaurant_can_become_the_group_match(source: str) -> None:
    venue = restaurant(source=source)
    db = FakeDb([SingleResult(venue)])
    session = SimpleNamespace(id=uuid.uuid4(), status=SessionStatus.ACTIVE)

    match = await MatchService(db)._persist(session, venue.id, ResolutionType.MAJORITY)

    assert match.restaurant_id == venue.id
    assert match.restaurant_name == venue.name
    assert session.status == SessionStatus.FINISHED
