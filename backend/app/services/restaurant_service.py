"""Restaurant business logic — search, deck generation, deck persistence."""

import logging
import random
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, distinct, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import NotFoundException
from app.models.restaurant import Restaurant
from app.models.session import Session
from app.models.session_deck import SessionDeck
from app.models.user import User
from app.models.vote import Vote
from app.schemas.restaurant import DeckResponse, RestaurantCardResponse, SoloFilterRequest
from app.services.google_places_service import GooglePlacesService
from app.services.osm_fallback_service import OsmFallbackService
from app.utils.geo import bounding_box, calculate_distance_km
from app.utils.places import (
    is_open_at,
    now_in_timezone,
    price_level_to_symbol,
    price_tier_to_levels,
)

logger = logging.getLogger(__name__)


class RestaurantService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_categories(self) -> list[str]:
        """Distinct display categories, for the Explore page."""
        query = select(distinct(Restaurant.primary_category)).order_by(Restaurant.primary_category)
        result = await self.db.execute(self._apply_data_mode(query))
        return [row[0] for row in result.all()]

    async def get_solo_deck(
        self, filters: SoloFilterRequest, user: User, actor_key: str | None = None
    ) -> DeckResponse:
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

        # Solo swipes are persisted, including skips, so refreshing the same
        # area cannot reshuffle restaurants the user has already judged.
        seen_result = await self.db.execute(
            select(Vote.restaurant_id).where(
                Vote.user_id == user.id,
                Vote.session_id.is_(None),
            )
        )
        seen_ids = set(seen_result.scalars().all())
        available = [restaurant for restaurant in restaurants if restaurant.id not in seen_ids]

        # Random order, capped at MAX_DECK_SIZE (requirement 10.3).
        random.shuffle(available)
        deck = available[: settings.MAX_DECK_SIZE]

        external_status = "not_needed"
        quota_warning = False
        google_cards: list[RestaurantCardResponse] = []
        if self._should_request_google(len(restaurants), filters.radius_km):
            if (
                filters.price_level is not None
                or filters.min_rating is not None
                or filters.open_now
            ):
                # The minimal field mask deliberately omits these attributes,
                # so live results cannot honestly satisfy these filters.
                external_status = "filters_unsupported"
            elif not settings.GOOGLE_PLACES_ENABLED or not settings.GOOGLE_PLACES_API_KEY:
                external_status = "disabled"
            else:
                result = await GooglePlacesService().search_nearby(
                    latitude=filters.latitude,
                    longitude=filters.longitude,
                    radius_km=filters.radius_km,
                    actor_key=actor_key or str(user.id),
                    category=filters.category,
                )
                external_status = result.status
                quota_warning = result.quota_warning
                google_cards = self._deduplicate_google_cards(result.cards, restaurants)

        google_cards = google_cards[: settings.MAX_DECK_SIZE - len(deck)]
        cards = [self.to_card(r, filters.latitude, filters.longitude) for r in deck]
        cards.extend(google_cards)
        if google_cards and deck:
            data_source = "mixed_live"
        elif google_cards:
            data_source = "google_live"
        else:
            data_source = self._data_source(deck)
        return DeckResponse(
            restaurants=cards,
            total=len(cards),
            data_source=data_source,
            coverage_status=self._coverage_status(len(cards)),
            suggested_radius_km=self._suggested_radius(filters.radius_km, len(cards)),
            external_status=external_status,
            quota_warning=quota_warning,
        )

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

        # A shared session needs enough choices for voting to be meaningful.
        # Solo mode still returns a smaller, explicitly partial deck.
        if len(restaurants) < settings.MIN_LOCAL_RESTAURANTS:
            return []

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
            data_source=self._data_source(
                [entry.restaurant for entry in entries if entry.restaurant is not None]
            ),
            coverage_status=self._coverage_status(len(cards)),
            suggested_radius_km=self._suggested_radius(session.radius_km, len(cards)),
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
        query = self._apply_data_mode(select(Restaurant))
        query = self._apply_bounding_box(query, latitude, longitude, radius_km)

        if category:
            query = query.where(Restaurant.primary_category == category)

        if price_tier is not None:
            # The UI offers three tiers; the database stores Google's 0-4.
            levels = price_tier_to_levels(price_tier)
            if levels:
                query = query.where(Restaurant.price_level.in_(levels))

        if min_rating is not None:
            query = query.where(Restaurant.rating >= min_rating)

        within_radius = await self._execute_radius_query(query, latitude, longitude, radius_km)

        google_live_enabled = (
            settings.GOOGLE_PLACES_ENABLED and bool(settings.GOOGLE_PLACES_API_KEY)
        )
        if (
            not within_radius
            and settings.RESTAURANT_FALLBACK_PROVIDER == "osm"
            and not google_live_enabled
        ):
            # A filter yielding no matches must not trigger an external call if
            # this area is already represented locally. Only a genuinely empty
            # area needs on-demand discovery.
            area_query = self._apply_data_mode(select(Restaurant))
            area_query = self._apply_bounding_box(area_query, latitude, longitude, radius_km)
            local_area = await self._execute_radius_query(
                area_query, latitude, longitude, radius_km
            )
            # Local-first: ask the user to widen the radius before spending an
            # external discovery request. The fallback is the last resort at
            # the configured launch-area maximum.
            if self._should_request_fallback(len(local_area), radius_km):
                try:
                    await OsmFallbackService().ensure_area(latitude, longitude, radius_km)
                    within_radius = await self._execute_radius_query(
                        query, latitude, longitude, radius_km
                    )
                except Exception:
                    # Restaurant discovery should degrade to an empty deck if a
                    # public endpoint is unavailable, not fail the whole app.
                    logger.exception("OSM fallback failed near %.5f, %.5f", latitude, longitude)

        if not open_now:
            return within_radius

        # Evaluated in Python: matching Google's `periods` structure in SQL
        # would be far harder to read for no practical gain at this data size.
        moment = now_in_timezone(settings.APP_TIMEZONE)
        return [r for r in within_radius if is_open_at(r.opening_hours, moment)]

    async def _execute_radius_query(
        self,
        query: Select,
        latitude: float,
        longitude: float,
        radius_km: float,
    ) -> list[Restaurant]:
        result = await self.db.execute(query)
        candidates = list(result.scalars().all())
        # The bounding box is a square around the circle, so drop the corners.
        return [
            restaurant
            for restaurant in candidates
            if calculate_distance_km(
                latitude,
                longitude,
                restaurant.latitude,
                restaurant.longitude,
            )
            <= radius_km
        ]

    @staticmethod
    def _apply_data_mode(query: Select) -> Select:
        """Hide synthetic rows from new discovery in production.

        Direct lookups and persisted session decks deliberately remain
        unfiltered so historical votes and sessions never break.
        """
        now = datetime.now(UTC)
        query = query.where(
            or_(
                Restaurant.is_permanent.is_(True),
                Restaurant.expires_at.is_(None),
                Restaurant.expires_at > now,
            )
        )
        if settings.RESTAURANT_DATA_MODE == "production":
            query = query.where(Restaurant.source.in_(("osm", "manual")))
        return query

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
            source=restaurant.source,
            name=restaurant.name,
            primary_category=restaurant.primary_category,
            types=restaurant.types or [],
            photo_url=restaurant.photo_url,
            photo_source=restaurant.photo_source,
            photo_attribution=restaurant.photo_attribution,
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

    @staticmethod
    def _coverage_status(count: int) -> str:
        """Describe whether this request has enough local choices."""
        if count >= settings.MIN_LOCAL_RESTAURANTS:
            return "full"
        if count > 0:
            return "partial"
        return "unsupported"

    @staticmethod
    def _suggested_radius(radius_km: float, count: int) -> float | None:
        """Suggest the next 500 m step before another provider is considered."""
        if count >= settings.MIN_LOCAL_RESTAURANTS or radius_km >= settings.MAX_RADIUS_KM:
            return None
        return round(min(radius_km + 0.5, settings.MAX_RADIUS_KM), 1)

    @staticmethod
    def _should_request_fallback(local_count: int, radius_km: float) -> bool:
        """Use external discovery only after local radius expansion is exhausted."""
        return local_count == 0 and radius_km >= settings.MAX_RADIUS_KM

    @staticmethod
    def _should_request_google(local_count: int, radius_km: float) -> bool:
        """Google is a last-resort Solo supplement at the maximum radius."""
        return (
            local_count < settings.MIN_LOCAL_RESTAURANTS
            and radius_km >= settings.MAX_RADIUS_KM
        )

    @staticmethod
    def _deduplicate_google_cards(
        google_cards: list[RestaurantCardResponse], local_restaurants: list[Restaurant]
    ) -> list[RestaurantCardResponse]:
        """Drop obvious live duplicates without persisting Google content."""
        unique: list[RestaurantCardResponse] = []
        for card in google_cards:
            duplicate = any(
                card.name.casefold().strip() == local.name.casefold().strip()
                and calculate_distance_km(
                    card.latitude,
                    card.longitude,
                    local.latitude,
                    local.longitude,
                )
                <= 0.1
                for local in local_restaurants
            )
            if not duplicate:
                unique.append(card)
        return unique

    @staticmethod
    def _data_source(restaurants: list[Restaurant]) -> str:
        """Summarise whether cards came from durable local data or OSM TTL cache."""
        if not restaurants:
            return "none"
        has_local = any(restaurant.is_permanent for restaurant in restaurants)
        has_cache = any(not restaurant.is_permanent for restaurant in restaurants)
        if has_local and has_cache:
            return "mixed"
        return "local" if has_local else "osm_cache"
