"""Photo previews use fake Google responses; never contact paid APIs."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.config import settings
from app.services.google_places_service import GooglePlacesService
from app.services.quota_service import QuotaDecision
from tests.test_google_places import TU_LAT, TU_LNG, FakeClient, FakeResponse


@pytest.fixture
def photos_enabled(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_PLACES_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_PLACES_API_KEY", "secret-key")
    monkeypatch.setattr(settings, "GOOGLE_PLACES_PHOTOS_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_PHOTO_HARD_LIMIT", 100)


def places(count=20):
    return [
        {
            "id": f"place-{index}",
            "displayName": {"text": f"Restaurant {index}"},
            "location": {"latitude": TU_LAT, "longitude": TU_LNG},
            "photos": [{
                "name": f"places/place-{index}/photos/photo-{index}",
                "googleMapsUri": "https://maps.google.com/photo/source",
                "authorAttributions": [
                    {"displayName": "Author A", "uri": "https://maps.google.com/a"},
                    {"displayName": "Author B", "uri": "https://maps.google.com/b"},
                ],
            }],
        }
        for index in range(count)
    ]


class PhotoClient(FakeClient):
    async def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse({"photoUri": "https://lh3.googleusercontent.com/live-photo"})


async def search(service):
    return await service.search_nearby(
        latitude=TU_LAT, longitude=TU_LNG, radius_km=0.5, actor_key="actor"
    )


@pytest.mark.asyncio
async def test_twenty_restaurants_only_first_five_photos_and_all_authors(
    monkeypatch, photos_enabled
):
    client = PhotoClient(FakeResponse({"places": places()}))
    monkeypatch.setattr("app.services.google_places_service.httpx.AsyncClient", lambda **_: client)
    quota = SimpleNamespace(reserve=AsyncMock(
        return_value=QuotaDecision(True, 1, False, "allowed")
    ))
    service = GooglePlacesService(quota=quota)
    result = await search(service)
    assert len(result.cards) == 20
    assert client.calls[0][1]["json"]["maxResultCount"] == 20
    assert "places.photos" in client.calls[0][1]["headers"]["X-Goog-FieldMask"]
    assert not any(card.photo_url for card in result.cards)
    await service.add_preview_photos(result.cards, actor_key="actor")
    assert len(client.calls) == 6  # One search and exactly five media calls.
    assert all(card.photo_url for card in result.cards[:5])
    assert all(card.photo_url is None for card in result.cards[5:])
    assert all(card.google_photo_name is None for card in result.cards[5:])
    assert result.cards[0].photo_attribution == "Author A; Author B"
    assert len(result.cards[0].google_photo_authors) == 2
    assert quota.reserve.await_count == 6
    assert "secret-key" not in result.cards[0].model_dump_json()
    for _, request in client.calls[1:]:
        assert request["params"]["skipHttpRedirect"] == "true"
        assert request["headers"]["X-Goog-Api-Key"] == "secret-key"


@pytest.mark.asyncio
async def test_photo_quota_exhausted_keeps_all_restaurants(monkeypatch, photos_enabled):
    client = PhotoClient(FakeResponse({"places": places()}))
    monkeypatch.setattr("app.services.google_places_service.httpx.AsyncClient", lambda **_: client)
    decisions = [QuotaDecision(True, 1, False, "allowed")] + [
        QuotaDecision(False, 100, True, "hard_limit") for _ in range(5)
    ]
    service = GooglePlacesService(quota=SimpleNamespace(
        reserve=AsyncMock(side_effect=decisions)
    ))
    result = await search(service)
    assert await service.add_preview_photos(result.cards, actor_key="actor") is True
    assert len(result.cards) == 20
    assert not any(card.photo_url for card in result.cards)
    assert len(client.calls) == 1


@pytest.mark.asyncio
async def test_photos_follow_final_deck_selection_and_skip_missing_photos(
    monkeypatch, photos_enabled
):
    raw = places()
    raw[6]["photos"] = []
    client = PhotoClient(FakeResponse({"places": raw}))
    monkeypatch.setattr("app.services.google_places_service.httpx.AsyncClient", lambda **_: client)
    service = GooglePlacesService(quota=SimpleNamespace(reserve=AsyncMock(
        return_value=QuotaDecision(True, 1, False, "allowed")
    )))
    result = await search(service)
    final_deck = result.cards[5:]  # Simulates deduplication before photo resolution.
    await service.add_preview_photos(final_deck, actor_key="actor")
    assert final_deck[0].photo_url
    assert final_deck[1].photo_url is None
    assert sum(bool(card.photo_url) for card in final_deck) == 4
    assert all(card.photo_url is None for card in final_deck[5:])
    assert len(client.calls) == 5  # One search, four photos; no sixth-card refill.


@pytest.mark.asyncio
async def test_photo_http_failure_does_not_retry_or_drop_cards(monkeypatch, photos_enabled):
    client = PhotoClient(FakeResponse({"places": places(1)}))
    client.get = AsyncMock(return_value=FakeResponse({}, status_code=503))
    monkeypatch.setattr("app.services.google_places_service.httpx.AsyncClient", lambda **_: client)
    quota = SimpleNamespace(reserve=AsyncMock(
        return_value=QuotaDecision(True, 1, False, "allowed")
    ))
    service = GooglePlacesService(quota=quota)
    result = await search(service)
    await service.add_preview_photos(result.cards, actor_key="actor")
    assert len(result.cards) == 1 and result.cards[0].photo_url is None
    assert client.get.await_count == 1
    assert quota.reserve.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("uri", [
    "http://lh3.googleusercontent.com/photo",
    "https://places.googleapis.com/v1/photo?key=secret-key",
    "https://attacker.example/photo",
])
async def test_unsafe_photo_uri_is_not_sent_to_mobile(monkeypatch, photos_enabled, uri):
    client = PhotoClient(FakeResponse({"places": places(1)}))
    client.get = AsyncMock(return_value=FakeResponse({"photoUri": uri}))
    monkeypatch.setattr("app.services.google_places_service.httpx.AsyncClient", lambda **_: client)
    service = GooglePlacesService(quota=SimpleNamespace(reserve=AsyncMock(
        return_value=QuotaDecision(True, 1, False, "allowed")
    )))
    result = await search(service)
    await service.add_preview_photos(result.cards, actor_key="actor")
    assert result.cards[0].photo_url is None
