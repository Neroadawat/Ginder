"""Restaurant business logic — search, deck generation, deck persistence."""

import random
from uuid import UUID

from sqlalchemy import Select, distinct, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import NotFoundException
from app.models.restaurant import Restaurant
from app.models.session import Session
from app.models.session_deck import SessionDeck
from app.models.user import User
from app.schemas.restaurant import DeckResponse, RestaurantCardResponse, SoloFilterRequest
from app.utils.geo import bounding_box, calculate_distance_km
from app.utils.places import (
    is_open_at,
    now_in_timezone,
    price_level_to_symbol,
    price_tier_to_levels,
)


class RestaurantService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_categories(self) -> list[str]:
        """Distinct display categories, for the Explore page."""
        result = await self.db.execute(
            select(distinct(Restaurant.primary_category)).order_by(Restaurant.primary_category)
        )
        return [row[0] for row in result.all()]

    async def get_solo_deck(self, filters: SoloFilterRequest, user: User) -> DeckResponse:
        """Build a solo-mode deck around the user's own location."""
        restaurants = await self._search(
            latitude=filters.latitude,
            longitude=filters.longitude,
            radius_km=filters.radius_km,
            category=filters.category,
            price_tier=filters.price_level,
            min_rating=filters.min_rating,
            open_now=filters.open_now,
        )

        # Random order, capped at MAX_DECK_SIZE (requirement 10.3).
        random.shuffle(restaurants)
        deck = restaurants[: settings.MAX_DECK_SIZE]

        cards = [self.to_card(r, filters.latitude, filters.longitude) for r in deck]
        return DeckResponse(restaurants=cards, total=len(cards))

    async def create_session_deck(self, session: Session) -> list[Restaurant]:
        """Shuffle once and persist the result as the session's deck.

        Called when the host presses Start. After this the order is fixed for
        the lifetime of the session (requirement 8.3).
        """
        restaurants = await self._search(
            latitude=session.latitude,
            longitude=session.longitude,
            radius_km=session.radius_km,
            category=session.category_filter,
            price_tier=session.price_filter,
            min_rating=session.rating_filter,
            open_now=session.open_now_filter,
        )

        random.shuffle(restaurants)
        deck = restaurants[: settings.MAX_DECK_SIZE]

        for position, restaurant in enumerate(deck):
            self.db.add(
                SessionDeck(
                    session_id=session.id,
                    restaurant_id=restaurant.id,
                    position=position,
                )
            )

        await self.db.flush()
        return deck

    async def get_session_deck(self, session: Session) -> DeckResponse:
        """Read back the persisted deck, in its stored order.

        Distances are measured from the host's location because that is the
        centre the deck was built around (requirement 7.1).
        """
        result = await self.db.execute(
            select(SessionDeck)
            .options(selectinload(SessionDeck.restaurant))
            .where(SessionDeck.session_id == session.id)
            .order_by(SessionDeck.position)
        )
        entries = result.scalars().all()

        cards = [
            self.to_card(entry.restaurant, session.latitude, session.longitude)
            for entry in entries
            if entry.restaurant is not None
        ]

        return DeckResponse(
            session_id=session.id,
            restaurants=cards,
            total=len(cards),
        )

    async def get_session_deck_restaurant_ids(self, session_id: UUID) -> list[UUID]:
        """Restaurant IDs in the session's deck.

        Used by the no-match wheel, which must draw from the whole deck rather
        than only from restaurants somebody happened to swipe (requirement 9.5).
        """
        result = await self.db.execute(
            select(SessionDeck.restaurant_id)
            .where(SessionDeck.session_id == session_id)
            .order_by(SessionDeck.position)
        )
        return [row[0] for row in result.all()]

    async def get_restaurant(self, restaurant_id: UUID) -> RestaurantCardResponse:
        """Fetch a single restaurant."""
        result = await self.db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
        restaurant = result.scalar_one_or_none()
        if not restaurant:
            raise NotFoundException("Restaurant not found")

        return self.to_card(restaurant)

    # ─── Private helpers ───

    async def _search(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
        category: str | None = None,
        price_tier: int | None = None,
        min_rating: float | None = None,
        open_now: bool = False,
    ) -> list[Restaurant]:
        """Find restaurants matching a location, radius and filters.

        Queries by geographic bounding box rather than cache key. Cache keys
        snap the centre to a ~400 m grid and bucket the radius, so two people
        standing at opposite ends of the same campus would generate different
        keys and one of them would get an empty deck (requirement 15.4).
        """
        query = self._apply_bounding_box(select(Restaurant), latitude, longitude, radius_km)

        if category:
            query = query.where(Restaurant.primary_category == category)

        if price_tier is not None:
            # The UI offers three tiers; the database stores Google's 0-4.
            levels = price_tier_to_levels(price_tier)
            if levels:
                query = query.where(Restaurant.price_level.in_(levels))

        if min_rating is not None:
            query = query.where(Restaurant.rating >= min_rating)

        result = await self.db.execute(query)
        candidates = list(result.scalars().all())

        # The bounding box is a square around the circle, so drop the corners.
        within_radius = [
            r
            for r in candidates
            if calculate_distance_km(latitude, longitude, r.latitude, r.longitude) <= radius_km
        ]

        if not open_now:
            return within_radius

        # Evaluated in Python: matching Google's `periods` structure in SQL
        # would be far harder to read for no practical gain at this data size.
        moment = now_in_timezone(settings.APP_TIMEZONE)
        return [r for r in within_radius if is_open_at(r.opening_hours, moment)]

    @staticmethod
    def _apply_bounding_box(
        query: Select, latitude: float, longitude: float, radius_km: float
    ) -> Select:
        """Narrow a query to a lat/lng box containing the radius.

        Lets the index do the coarse work instead of loading every row.
        """
        min_lat, max_lat, min_lng, max_lng = bounding_box(latitude, longitude, radius_km)
        return query.where(
            Restaurant.latitude >= min_lat,
            Restaurant.latitude <= max_lat,
            Restaurant.longitude >= min_lng,
            Restaurant.longitude <= max_lng,
        )

    def to_card(
        self,
        restaurant: Restaurant,
        ref_lat: float | None = None,
        ref_lng: float | None = None,
    ) -> RestaurantCardResponse:
        """Convert a Restaurant row into the card payload the app renders.

        Public because the Likes tab needs the same shape (requirement 11.3).
        """
        distance = None
        if ref_lat is not None and ref_lng is not None:
            distance = round(
                calculate_distance_km(ref_lat, ref_lng, restaurant.latitude, restaurant.longitude),
                2,
            )

        return RestaurantCardResponse(
            id=restaurant.id,
            place_id=restaurant.place_id,
            name=restaurant.name,
            primary_category=restaurant.primary_category,
            types=restaurant.types or [],
            photo_url=restaurant.photo_url,
            latitude=restaurant.latitude,
            longitude=restaurant.longitude,
            distance_km=distance,
            price_level=restaurant.price_level,
            price_symbol=price_level_to_symbol(restaurant.price_level),
            rating=restaurant.rating,
            user_ratings_total=restaurant.user_ratings_total,
            address=restaurant.address,
            google_maps_url=restaurant.google_maps_url,
        )
