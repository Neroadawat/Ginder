"""Ephemeral Google Places (New) fallback for Solo discovery only."""

import logging
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import quote_plus
from uuid import NAMESPACE_URL, uuid5

import httpx

from app.core.config import settings
from app.schemas.restaurant import RestaurantCardResponse
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
        "places.photos",
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
            status: ExternalStatus = (
                "quota_exhausted" if decision.reason == "hard_limit" else "rate_limited"
            )
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
            "X-Goog-FieldMask": _FIELD_MASK,
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
        except (httpx.HTTPError, ValueError, AttributeError):
            # Never include the request headers or coordinates in logs.
            logger.warning("Google Places nearby_search failed", exc_info=True)
            return GoogleSearchResult([], "failed", decision.soft_limit_reached)

        cards = [
            card
            for place in raw_places
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
        return GoogleSearchResult(cards, "available", decision.soft_limit_reached)

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

        photos = place.get("photos") or []
        photo = photos[0] if photos and isinstance(photos[0], dict) else {}
        attributions = photo.get("authorAttributions") or []
        author_names = [
            item.get("displayName")
            for item in attributions
            if isinstance(item, dict) and item.get("displayName")
        ]
        author_uri = next(
            (
                item.get("uri")
                for item in attributions
                if isinstance(item, dict) and item.get("uri")
            ),
            None,
        )

        return RestaurantCardResponse(
            id=uuid5(NAMESPACE_URL, f"google:{place_id}"),
            place_id=f"google:{place_id}",
            source="google_live",
            name=name,
            primary_category=primary_category,
            types=[primary_type],
            photo_url=None,
            photo_source=author_uri,
            photo_attribution=", ".join(author_names) or None,
            google_photo_name=photo.get("name"),
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
            address=None,
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
