"""Restaurant business logic — fetch, cache, deck generation."""

import random
from uuid import UUID

from sqlalchemy import Select, distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundException
from app.models.restaurant import Restaurant
from app.models.session import Session
from app.models.user import User
from app.schemas.restaurant import DeckResponse, RestaurantCardResponse, SoloFilterRequest
from app.utils.geo import bounding_box, calculate_distance_km, generate_cache_key


class RestaurantService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_categories(self) -> list[str]:
        """Get all distinct restaurant categories."""
        result = await self.db.execute(
            select(distinct(Restaurant.category)).order_by(Restaurant.category)
        )
        return [row[0] for row in result.all()]

    async def get_solo_deck(self, filters: SoloFilterRequest, user: User) -> DeckResponse:
        """Get a deck of restaurants for solo mode based on the user's own location."""
        restaurants = await self._fetch_restaurants(
            latitude=filters.latitude,
            longitude=filters.longitude,
            radius_km=filters.radius_km,
            category=filters.category,
            price_level=filters.price_level,
            min_rating=filters.min_rating,
        )

        # Random order, capped at MAX_DECK_SIZE (requirement 2.5)
        random.shuffle(restaurants)
        deck = restaurants[: settings.MAX_DECK_SIZE]

        cards = [self._to_card(r, filters.latitude, filters.longitude) for r in deck]
        return DeckResponse(restaurants=cards, total=len(cards))

    async def generate_session_deck(self, session: Session) -> list[Restaurant]:
        """Generate the restaurant deck for a party session, centred on the host."""
        # Record the cache key for traceability even when querying by distance.
        session.cache_key = generate_cache_key(
            session.latitude,
            session.longitude,
            session.radius_km,
            session.category_filter,
        )

        restaurants = await self._fetch_restaurants(
            latitude=session.latitude,
            longitude=session.longitude,
            radius_km=session.radius_km,
            category=session.category_filter,
            price_level=session.price_filter,
            min_rating=session.rating_filter,
        )

        random.shuffle(restaurants)
        return restaurants[: settings.MAX_DECK_SIZE]

    async def get_session_deck(self, session: Session) -> DeckResponse:
        """Rebuild a session's deck for a reconnecting client.

        Distances are measured from the host's location, matching how the deck
        was originally generated (requirement 2.3).
        """
        restaurants = await self._fetch_restaurants(
            latitude=session.latitude,
            longitude=session.longitude,
            radius_km=session.radius_km,
            category=session.category_filter,
            price_level=session.price_filter,
            min_rating=session.rating_filter,
        )

        # Deterministic order per session so every participant and every
        # reconnect sees the same deck (requirement 3: "จ่ายไพ่ชุดเดียวกัน").
        random.Random(str(session.id)).shuffle(restaurants)
        deck = restaurants[: settings.MAX_DECK_SIZE]

        cards = [self._to_card(r, session.latitude, session.longitude) for r in deck]
        return DeckResponse(
            session_id=session.id,
            restaurants=cards,
            total=len(cards),
        )

    async def get_restaurant(self, restaurant_id: UUID) -> RestaurantCardResponse:
        """Get a single restaurant by ID."""
        result = await self.db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
        restaurant = result.scalar_one_or_none()
        if not restaurant:
            raise NotFoundException("Restaurant not found")

        return self._to_card(restaurant)

    # ─── Private helpers ───

    async def _fetch_restaurants(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
        category: str | None = None,
        price_level: int | None = None,
        min_rating: float | None = None,
    ) -> list[Restaurant]:
        """Fetch restaurants matching a location, radius and filters.

        Two strategies:

        * ``dummy`` provider (locally seeded data) — query purely by geographic
          bounding box. Cache keys are skipped on purpose: they snap the centre
          to a ~400 m grid and bucket the radius, so two users standing at
          different ends of the same campus would generate different keys and
          one of them would get an empty deck.
        * external provider — filter by cache key so we reuse whatever was
          previously fetched and stored for that grid cell.

        Both paths end with the same exact Haversine filter.
        """
        query = select(Restaurant)

        if settings.RESTAURANT_API_PROVIDER == "dummy":
            query = self._apply_bounding_box(query, latitude, longitude, radius_km)
        else:
            cache_key = generate_cache_key(latitude, longitude, radius_km, category)
            query = query.where(Restaurant.cache_key == cache_key)
            # TODO: when the set is empty, fetch from the external provider and
            # persist the results under this cache key before returning.

        if category:
            query = query.where(Restaurant.category == category)
        if price_level is not None:
            query = query.where(Restaurant.price_level == price_level)
        if min_rating is not None:
            query = query.where(Restaurant.rating >= min_rating)

        result = await self.db.execute(query)
        candidates = list(result.scalars().all())

        # The bounding box includes the corners of the square around the circle,
        # so reject anything outside the true radius.
        return [
            r
            for r in candidates
            if calculate_distance_km(latitude, longitude, r.latitude, r.longitude) <= radius_km
        ]

    @staticmethod
    def _apply_bounding_box(
        query: Select, latitude: float, longitude: float, radius_km: float
    ) -> Select:
        """Narrow a query to a lat/lng box containing the radius.

        Lets the database index do the heavy lifting instead of loading every
        row and filtering in Python.
        """
        min_lat, max_lat, min_lng, max_lng = bounding_box(latitude, longitude, radius_km)
        return query.where(
            Restaurant.latitude >= min_lat,
            Restaurant.latitude <= max_lat,
            Restaurant.longitude >= min_lng,
            Restaurant.longitude <= max_lng,
        )

    def _to_card(
        self,
        restaurant: Restaurant,
        ref_lat: float | None = None,
        ref_lng: float | None = None,
    ) -> RestaurantCardResponse:
        """Convert a Restaurant model to a card response."""
        distance = None
        if ref_lat is not None and ref_lng is not None:
            distance = round(
                calculate_distance_km(ref_lat, ref_lng, restaurant.latitude, restaurant.longitude),
                2,
            )

        return RestaurantCardResponse(
            id=restaurant.id,
            name=restaurant.name,
            category=restaurant.category,
            image_url=restaurant.image_url,
            latitude=restaurant.latitude,
            longitude=restaurant.longitude,
            distance_km=distance,
            price_level=restaurant.price_level,
            rating=restaurant.rating,
            address=restaurant.address,
            google_maps_url=restaurant.google_maps_url,
        )
