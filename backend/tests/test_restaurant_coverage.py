"""Phase 4 local-first deck metadata."""

from types import SimpleNamespace

from app.core.config import settings
from app.services.restaurant_service import RestaurantService


def test_coverage_status_uses_configured_minimum() -> None:
    assert RestaurantService._coverage_status(0) == "unsupported"
    assert RestaurantService._coverage_status(settings.MIN_LOCAL_RESTAURANTS - 1) == "partial"
    assert RestaurantService._coverage_status(settings.MIN_LOCAL_RESTAURANTS) == "full"


def test_radius_suggestion_stops_when_coverage_is_full_or_radius_is_maximum() -> None:
    assert RestaurantService._suggested_radius(1.0, 2) == 1.5
    assert (
        RestaurantService._suggested_radius(1.0, settings.MIN_LOCAL_RESTAURANTS) is None
    )
    assert RestaurantService._suggested_radius(settings.MAX_RADIUS_KM, 0) is None


def test_external_fallback_waits_until_the_maximum_radius() -> None:
    assert RestaurantService._should_request_fallback(0, 1.5) is False
    assert RestaurantService._should_request_fallback(1, settings.MAX_RADIUS_KM) is False
    assert RestaurantService._should_request_fallback(0, settings.MAX_RADIUS_KM) is True


def test_data_source_distinguishes_local_and_ttl_cache() -> None:
    local = SimpleNamespace(is_permanent=True)
    cached = SimpleNamespace(is_permanent=False)

    assert RestaurantService._data_source([]) == "none"
    assert RestaurantService._data_source([local]) == "local"
    assert RestaurantService._data_source([cached]) == "osm_cache"
    assert RestaurantService._data_source([local, cached]) == "mixed"
