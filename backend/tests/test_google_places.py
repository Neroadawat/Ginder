"""Phase 8 ephemeral Google Places fallback behaviour."""

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.config import settings
from app.models.restaurant import Restaurant
from app.schemas.restaurant import RestaurantCardResponse, SoloFilterRequest
from app.services.google_places_service import GooglePlacesService, GoogleSearchResult
from app.services.quota_service import QuotaDecision
from app.services.restaurant_service import RestaurantService

TU_LAT = 14.0708
TU_LNG = 100.6065


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.request = httpx.Request("POST", "https://places.googleapis.com")

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "request failed", request=self.request, response=self
            )

    def json(self):
        return self.payload


class FakeClient:
    def __init__(self, response):
        self.response = response
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response

    async def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class ListResult:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class FakeDb:
    def __init__(self):
        self.executed = []
        self.added = []

    async def execute(self, statement):
        self.executed.append(statement)
        return ListResult([])

    def add(self, value):
        self.added.append(value)


def google_card(name: str = "Live restaurant") -> RestaurantCardResponse:
    return RestaurantCardResponse(
        id=uuid.uuid4(),
        place_id="google:test-place",
        source="google_live",
        name=name,
        primary_category="Thai",
        types=["thai_restaurant"],
        photo_url=None,
        photo_source=None,
        photo_attribution=None,
        google_photo_name=None,
        latitude=TU_LAT,
        longitude=TU_LNG,
        distance_km=0.1,
        price_level=None,
        price_symbol=None,
        rating=None,
        user_ratings_total=None,
        address=None,
        google_maps_url="https://www.google.com/maps/search/?api=1",
        can_like=False,
    )


def local_restaurant(index: int) -> Restaurant:
    return Restaurant(
        id=uuid.uuid4(),
        place_id=f"manual:local-{index}",
        source="manual",
        source_place_id=f"local-{index}",
        name=f"Local restaurant {index}",
        latitude=TU_LAT + index * 0.00001,
        longitude=TU_LNG,
        types=["restaurant"],
        primary_category="Restaurant",
        is_permanent=True,
    )


@pytest.mark.asyncio
async def test_nearby_search_uses_minimal_mask_and_parses_ephemeral_card(monkeypatch) -> None:
    quota = SimpleNamespace(
        reserve=AsyncMock(return_value=QuotaDecision(True, 1, False, "allowed"))
    )
    response = FakeResponse(
        {
            "places": [
                {
                    "id": "ChIJ-test",
                    "displayName": {"text": "ร้านทดสอบ"},
                    "primaryType": "thai_restaurant",
                    "location": {"latitude": TU_LAT + 0.001, "longitude": TU_LNG},
                    "photos": [
                        {
                            "name": "places/ChIJ-test/photos/photo-1",
                            "googleMapsUri": "https://maps.google.com/photo/test",
                            "authorAttributions": [
                                {"displayName": "เจ้าของภาพ", "uri": "https://maps.google.com"}
                            ],
                        }
                    ],
                }
            ]
        }
    )
    client = FakeClient(response)
    monkeypatch.setattr(
        "app.services.google_places_service.httpx.AsyncClient",
        lambda **_kwargs: client,
    )
    monkeypatch.setattr(settings, "GOOGLE_PLACES_API_KEY", "server-secret")

    result = await GooglePlacesService(quota=quota).search_nearby(
        latitude=TU_LAT,
        longitude=TU_LNG,
        radius_km=3.0,
        actor_key="hashed-actor",
    )

    assert result.status == "available"
    assert len(result.cards) == 1
    card = result.cards[0]
    assert card.source == "google_live"
    assert card.can_like is False
    assert card.google_photo_name == "places/ChIJ-test/photos/photo-1"
    assert card.google_photo_maps_uri == "https://maps.google.com/photo/test"
    assert card.photo_attribution == "เจ้าของภาพ"
    assert card.rating is None and card.price_level is None
    _, request = client.calls[0]
    assert request["headers"]["X-Goog-Api-Key"] == "server-secret"
    assert request["headers"]["X-Goog-FieldMask"] == (
        "places.id,places.displayName,places.primaryType,places.location,places.photos"
    )
    assert request["json"]["maxResultCount"] == 20


@pytest.mark.asyncio
async def test_photo_is_resolved_lazily_with_quota_and_no_api_key_in_url(
    monkeypatch,
) -> None:
    quota = SimpleNamespace(
        reserve=AsyncMock(return_value=QuotaDecision(True, 1, False, "allowed"))
    )
    client = FakeClient(FakeResponse({"photoUri": "//lh3.googleusercontent.com/photo"}))
    monkeypatch.setattr(
        "app.services.google_places_service.httpx.AsyncClient",
        lambda **_kwargs: client,
    )
    monkeypatch.setattr(settings, "GOOGLE_PLACES_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_PLACES_API_KEY", "server-secret")
    photo_name = "places/ChIJ-test/photos/photo-1"

    result = await GooglePlacesService(quota=quota).get_photo_uri(
        photo_name=photo_name,
        actor_key="hashed-actor",
    )

    assert result.status == "available"
    assert result.photo_uri == "https://lh3.googleusercontent.com/photo"
    quota.reserve.assert_awaited_once_with(
        "place_photo", "hashed-actor", request_key=photo_name
    )
    url, request = client.calls[0]
    assert url.endswith(f"/{photo_name}/media")
    assert "server-secret" not in url
    assert request["headers"]["X-Goog-Api-Key"] == "server-secret"
    assert request["params"] == {
        "maxWidthPx": 1200,
        "maxHeightPx": 1600,
        "skipHttpRedirect": "true",
    }


@pytest.mark.asyncio
async def test_photo_hard_limit_uses_placeholder_without_google_call(monkeypatch) -> None:
    quota = SimpleNamespace(
        reserve=AsyncMock(return_value=QuotaDecision(False, 1000, True, "hard_limit"))
    )
    client_factory = AsyncMock()
    monkeypatch.setattr(
        "app.services.google_places_service.httpx.AsyncClient", client_factory
    )
    monkeypatch.setattr(settings, "GOOGLE_PLACES_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_PLACES_API_KEY", "server-secret")

    result = await GooglePlacesService(quota=quota).get_photo_uri(
        photo_name="places/ChIJ-test/photos/photo-1",
        actor_key="hashed-actor",
    )

    assert result.status == "quota_exhausted"
    assert result.photo_uri is None
    client_factory.assert_not_called()


@pytest.mark.asyncio
async def test_quota_block_prevents_google_http_call(monkeypatch) -> None:
    quota = SimpleNamespace(
        reserve=AsyncMock(return_value=QuotaDecision(False, 1000, True, "hard_limit"))
    )
    client_factory = AsyncMock()
    monkeypatch.setattr(
        "app.services.google_places_service.httpx.AsyncClient", client_factory
    )

    result = await GooglePlacesService(quota=quota).search_nearby(
        latitude=TU_LAT,
        longitude=TU_LNG,
        radius_km=3.0,
        actor_key="actor",
    )

    assert result.status == "quota_exhausted"
    client_factory.assert_not_called()


@pytest.mark.asyncio
async def test_google_error_degrades_to_empty_result(monkeypatch) -> None:
    quota = SimpleNamespace(
        reserve=AsyncMock(return_value=QuotaDecision(True, 1, False, "allowed"))
    )
    client = FakeClient(FakeResponse({}, status_code=503))
    monkeypatch.setattr(
        "app.services.google_places_service.httpx.AsyncClient",
        lambda **_kwargs: client,
    )

    result = await GooglePlacesService(quota=quota).search_nearby(
        latitude=TU_LAT,
        longitude=TU_LNG,
        radius_km=3.0,
        actor_key="actor",
    )

    assert result.cards == []
    assert result.status == "failed"


@pytest.mark.asyncio
async def test_solo_fallback_calls_google_once_and_never_writes_restaurant(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_PLACES_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_PLACES_API_KEY", "server-secret")
    db = FakeDb()
    service = RestaurantService(db)
    monkeypatch.setattr(service, "_search", AsyncMock(return_value=[]))
    search = AsyncMock(return_value=GoogleSearchResult([google_card()], "available"))
    monkeypatch.setattr(GooglePlacesService, "search_nearby", search)

    deck = await service.get_solo_deck(
        SoloFilterRequest(latitude=TU_LAT, longitude=TU_LNG, radius_km=3.0),
        SimpleNamespace(id=uuid.uuid4()),
        actor_key="hashed-actor",
    )

    assert search.await_count == 1
    assert deck.data_source == "google_live"
    assert deck.restaurants[0].can_like is False
    assert db.added == []


@pytest.mark.asyncio
async def test_solo_does_not_call_google_when_local_coverage_is_enough(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_PLACES_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_PLACES_API_KEY", "server-secret")
    service = RestaurantService(FakeDb())
    monkeypatch.setattr(
        service,
        "_search",
        AsyncMock(
            return_value=[
                local_restaurant(index)
                for index in range(settings.MIN_LOCAL_RESTAURANTS)
            ]
        ),
    )
    search = AsyncMock()
    monkeypatch.setattr(GooglePlacesService, "search_nearby", search)

    deck = await service.get_solo_deck(
        SoloFilterRequest(latitude=TU_LAT, longitude=TU_LNG, radius_km=3.0),
        SimpleNamespace(id=uuid.uuid4()),
        actor_key="hashed-actor",
    )

    assert deck.total == settings.MIN_LOCAL_RESTAURANTS
    assert deck.external_status == "not_needed"
    search.assert_not_awaited()


def test_google_api_key_is_not_present_in_mobile_source() -> None:
    frontend_src = Path(__file__).resolve().parents[2] / "frontend" / "src"
    contents = "\n".join(
        path.read_text(encoding="utf-8")
        for path in frontend_src.rglob("*")
        if path.suffix in {".ts", ".tsx", ".js", ".jsx"}
    )
    assert "GOOGLE_PLACES_API_KEY" not in contents
    assert "AIza" not in contents
