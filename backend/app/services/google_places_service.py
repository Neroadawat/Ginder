"""Ephemeral Google Places (New) fallback for Solo discovery only."""

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import quote_plus, urlparse
from uuid import NAMESPACE_URL, uuid5

import httpx

from app.core.config import settings
from app.schemas.restaurant import GooglePhotoAuthor, GooglePhotoResponse, RestaurantCardResponse
from app.services.quota_service import GoogleQuotaService
from app.utils.geo import calculate_distance_km

logger = logging.getLogger(__name__)

ExternalStatus = Literal[
    "available", "rate_limited", "quota_exhausted", "failed"
]

_FIELD_MASK = ",".join(
    (
        "places.id",
        "places.displayName",
        "places.primaryType",
        "places.location",
        "places.formattedAddress",
    )
)


@dataclass(frozen=True)
class GoogleSearchResult:
    cards: list[RestaurantCardResponse]
    status: ExternalStatus
    quota_warning: bool = False


class GooglePlacesService:
    def __init__(self, quota: GoogleQuotaService | None = None):
        self.quota = quota or GoogleQuotaService()

    async def search_nearby(
        self,
        *,
        latitude: float,
        longitude: float,
        radius_km: float,
        actor_key: str,
        category: str | None = None,
    ) -> GoogleSearchResult:
        """Return live cards without writing any Google content to the database."""
        decision = await self.quota.reserve("nearby_search", actor_key)
        if not decision.allowed:
            status: ExternalStatus = "failed"
            if decision.reason == "hard_limit":
                status = "quota_exhausted"
            elif decision.reason == "rate_limited":
                status = "rate_limited"
            return GoogleSearchResult([], status)

        logger.info(
            "Google Places nearby_search reserved for actor=%s count=%s",
            actor_key,
            decision.count,
        )
        payload = {
            "includedTypes": [
                "restaurant",
                "cafe",
                "fast_food_restaurant",
                "food_court",
            ],
            "maxResultCount": 20,
            "rankPreference": "DISTANCE",
            "languageCode": "th",
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": latitude, "longitude": longitude},
                    "radius": radius_km * 1000,
                }
            },
        }
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": (
                f"{_FIELD_MASK},places.photos" if self._photos_enabled() else _FIELD_MASK
            ),
        }

        try:
            async with httpx.AsyncClient(timeout=settings.GOOGLE_PLACES_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{settings.GOOGLE_PLACES_BASE_URL}/places:searchNearby",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                raw_places = response.json().get("places", [])
                if not isinstance(raw_places, list):
                    raise ValueError("Unexpected places response")
        except (httpx.HTTPError, ValueError, AttributeError):
            # Never include the request headers or coordinates in logs.
            logger.warning("Google Places nearby_search failed", exc_info=True)
            return GoogleSearchResult([], "failed", decision.soft_limit_reached)

        cards = [
            card
            for place in raw_places[:20]
            if isinstance(place, dict)
            and (
                card := self._to_card(
                    place,
                    latitude=latitude,
                    longitude=longitude,
                    category=category,
                )
            )
            is not None
        ]
        # Keep transient metadata until the final deck is selected. Media is
        # resolved only for its first five cards, never on client demand.
        if self._photos_enabled():
            by_id = {place.get("id"): place for place in raw_places if isinstance(place, dict)}
            for card in cards:
                place = by_id.get(card.place_id.removeprefix("google:"), {})
                photos = place.get("photos") or []
                if not isinstance(photos, list) or not photos or not isinstance(photos[0], dict):
                    continue
                photo = photos[0]
                photo_name = photo.get("name", "")
                if not isinstance(photo_name, str) or not re.fullmatch(
                    r"places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+", photo_name
                ):
                    continue
                card.google_photo_name = photo_name
                card.google_photo_maps_uri = self._https_url(photo.get("googleMapsUri"))
                authors = photo.get("authorAttributions") or []
                if isinstance(authors, list):
                    card.google_photo_authors = [
                        GooglePhotoAuthor(
                            display_name=author["displayName"],
                            uri=self._https_url(author.get("uri")),
                        )
                        for author in authors
                        if isinstance(author, dict)
                        and isinstance(author.get("displayName"), str)
                        and author["displayName"].strip()
                    ]
        return GoogleSearchResult(cards, "available", decision.soft_limit_reached)

    @staticmethod
    def _photos_enabled() -> bool:
        return (
            settings.GOOGLE_PLACES_ENABLED
            and bool(settings.GOOGLE_PLACES_API_KEY)
            and settings.GOOGLE_PLACES_PHOTOS_ENABLED
            and settings.GOOGLE_PHOTO_HARD_LIMIT > 0
        )

    @staticmethod
    def _https_url(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        try:
            parsed = urlparse(value)
        except ValueError:
            return None
        if parsed.scheme == "https" and parsed.hostname and not parsed.username:
            return value
        return None

    async def add_preview_photos(
        self, cards: list[RestaurantCardResponse], *, actor_key: str
    ) -> bool:
        """Resolve at most five photos with durable reservations; retain cards on failure."""
        if not self._photos_enabled():
            return False
        for card in cards[5:]:
            card.google_photo_name = None
            card.google_photo_maps_uri = None
            card.google_photo_authors = []
        async with httpx.AsyncClient(timeout=settings.GOOGLE_PLACES_TIMEOUT_SECONDS) as client:
            warnings = await asyncio.gather(
                *(self._load_preview_photo(client, card, actor_key) for card in cards[:5])
            )
        return any(warnings)

    async def _load_preview_photo(
        self, client: httpx.AsyncClient, card: RestaurantCardResponse, actor_key: str
    ) -> bool:
        photo_name = card.google_photo_name
        if card.source != "google_live" or not photo_name or not re.fullmatch(
            r"places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+", photo_name
        ):
            return False
        decision = await self.quota.reserve("place_photo", actor_key, request_key=photo_name)
        if not decision.allowed:
            return decision.soft_limit_reached
        try:
            response = await client.get(
                f"{settings.GOOGLE_PLACES_BASE_URL}/{photo_name}/media",
                headers={"X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY},
                params={"maxWidthPx": 800, "maxHeightPx": 800, "skipHttpRedirect": "true"},
            )
            response.raise_for_status()
            uri = self._https_url(response.json().get("photoUri"))
            if uri is None:
                raise ValueError("Invalid photo URI")
            host = urlparse(uri).hostname
            # Never expose a key-bearing API endpoint as the mobile image URL.
            if (
                not host
                or not any(
                    host == domain or host.endswith(f".{domain}")
                    for domain in ("googleusercontent.com", "ggpht.com")
                )
                or settings.GOOGLE_PLACES_API_KEY in uri
            ):
                raise ValueError("Invalid photo URI")
            card.photo_url = uri
            card.photo_source = card.google_photo_maps_uri or card.google_maps_url
            card.photo_attribution = "; ".join(
                author.display_name for author in card.google_photo_authors
            ) or "Google Maps"
        except (httpx.HTTPError, ValueError, AttributeError):
            # No retry: a failed attempt still consumed its reservation.
            logger.warning("Google Places preview photo failed")
        return decision.soft_limit_reached

    async def get_photo_uri(
        self, *, photo_name: str, actor_key: str
    ) -> GooglePhotoResponse:
        """Compatibility response for old clients: photo billing is disabled."""
        return GooglePhotoResponse(status="disabled")

    async def recover_session_cards(
        self, references: list[RestaurantCardResponse], *, actor_key: str,
        latitude: float, longitude: float,
    ) -> list[RestaurantCardResponse]:
        """Resolve identities on recovery without repeating discovery or photo calls."""
        if not settings.GOOGLE_PLACES_ENABLED or not settings.GOOGLE_PLACES_API_KEY:
            return references
        async with httpx.AsyncClient(timeout=settings.GOOGLE_PLACES_TIMEOUT_SECONDS) as client:
            async def load(reference: RestaurantCardResponse) -> RestaurantCardResponse:
                place_id = reference.place_id.removeprefix("google:")
                if not re.fullmatch(r"[A-Za-z0-9_-]+", place_id):
                    return reference
                decision = await self.quota.reserve(
                    "place_details", actor_key, request_key=place_id
                )
                if not decision.allowed:
                    return reference
                try:
                    response = await client.get(
                        f"{settings.GOOGLE_PLACES_BASE_URL}/places/{place_id}",
                        headers={
                            "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
                            "X-Goog-FieldMask": (
                                "id,displayName,primaryType,location,formattedAddress"
                            ),
                        },
                    )
                    response.raise_for_status()
                    card = self._to_card(
                        response.json(), latitude=latitude, longitude=longitude, category=None
                    )
                    if card and card.id == reference.id:
                        card.can_like = True
                        return card
                except (httpx.HTTPError, ValueError, AttributeError, TypeError):
                    logger.warning("Google party card details unavailable")
                return reference

            return list(await asyncio.gather(*(load(reference) for reference in references)))

    @classmethod
    def _to_card(
        cls,
        place: dict[str, Any],
        *,
        latitude: float,
        longitude: float,
        category: str | None,
    ) -> RestaurantCardResponse | None:
        place_id = place.get("id")
        name = place.get("displayName", {}).get("text")
        location = place.get("location", {})
        place_lat = location.get("latitude")
        place_lng = location.get("longitude")
        if not place_id or not name or place_lat is None or place_lng is None:
            return None

        primary_type = place.get("primaryType") or "restaurant"
        primary_category = cls._category(primary_type)
        if category and primary_category != category:
            return None

        return RestaurantCardResponse(
            id=uuid5(NAMESPACE_URL, f"google:{place_id}"),
            place_id=f"google:{place_id}",
            source="google_live",
            name=name,
            primary_category=primary_category,
            types=[primary_type],
            photo_url=None,
            photo_source=None,
            photo_attribution=None,
            google_photo_name=None,
            google_photo_maps_uri=None,
            latitude=float(place_lat),
            longitude=float(place_lng),
            distance_km=round(
                calculate_distance_km(
                    latitude,
                    longitude,
                    float(place_lat),
                    float(place_lng),
                ),
                2,
            ),
            price_level=None,
            price_symbol=None,
            rating=None,
            user_ratings_total=None,
            address=place.get("formattedAddress"),
            google_maps_url=(
                "https://www.google.com/maps/search/?api=1"
                f"&query={quote_plus(name)}&query_place_id={quote_plus(place_id)}"
            ),
            can_like=False,
        )

    @staticmethod
    def _category(primary_type: str) -> str:
        if primary_type == "thai_restaurant":
            return "Thai"
        if primary_type in {"japanese_restaurant", "sushi_restaurant", "ramen_restaurant"}:
            return "Japanese"
        if primary_type == "korean_restaurant":
            return "Korean"
        if primary_type in {"chinese_restaurant", "dim_sum_restaurant"}:
            return "Chinese"
        if primary_type in {"italian_restaurant", "pizza_restaurant"}:
            return "Italian"
        if primary_type == "indian_restaurant":
            return "Indian"
        if primary_type in {"cafe", "coffee_shop", "bakery"}:
            return "Cafe"
        if primary_type in {"ice_cream_shop", "dessert_shop"}:
            return "Dessert"
        if primary_type in {"fast_food_restaurant", "hamburger_restaurant"}:
            return "Fast Food"
        if primary_type == "food_court":
            return "Food Court"
        if primary_type == "steak_house":
            return "Steak"
        if primary_type == "hot_pot_restaurant":
            return "Hot Pot"
        return "Other"
