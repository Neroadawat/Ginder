"""Tests for the geo helpers that back radius search."""

import math

import pytest

from app.utils.geo import (
    _bucket_radius,
    bounding_box,
    calculate_distance_km,
    generate_cache_key,
)

# Thammasat University, Rangsit Campus — the launch area.
TU_RANGSIT_LAT = 14.0708
TU_RANGSIT_LNG = 100.6065


class TestCalculateDistanceKm:
    def test_same_point_is_zero(self):
        assert calculate_distance_km(
            TU_RANGSIT_LAT, TU_RANGSIT_LNG, TU_RANGSIT_LAT, TU_RANGSIT_LNG
        ) == pytest.approx(0.0, abs=1e-9)

    def test_one_degree_of_latitude_is_about_111km(self):
        distance = calculate_distance_km(0.0, 0.0, 1.0, 0.0)
        assert distance == pytest.approx(111.19, abs=0.1)

    def test_is_symmetric(self):
        forward = calculate_distance_km(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 14.1, 100.65)
        backward = calculate_distance_km(14.1, 100.65, TU_RANGSIT_LAT, TU_RANGSIT_LNG)
        assert forward == pytest.approx(backward)

    def test_known_bangkok_to_rangsit_distance(self):
        # Siam (13.7460, 100.5340) to TU Rangsit is roughly 36 km straight-line.
        distance = calculate_distance_km(13.7460, 100.5340, TU_RANGSIT_LAT, TU_RANGSIT_LNG)
        assert 33.0 < distance < 40.0

    def test_small_offset_within_campus(self):
        # ~0.009 degrees latitude is about 1 km.
        distance = calculate_distance_km(
            TU_RANGSIT_LAT, TU_RANGSIT_LNG, TU_RANGSIT_LAT + 0.009, TU_RANGSIT_LNG
        )
        assert distance == pytest.approx(1.0, abs=0.05)


class TestBoundingBox:
    @pytest.mark.parametrize("radius_km", [0.5, 1.0, 1.5, 2.0, 2.5, 3.0])
    def test_box_contains_every_point_inside_the_radius(self, radius_km):
        """The box must never clip a restaurant that is genuinely in range.

        This is the property the SQL prefilter depends on: if the box were too
        small, valid restaurants would silently disappear from the deck.
        """
        min_lat, max_lat, min_lng, max_lng = bounding_box(
            TU_RANGSIT_LAT, TU_RANGSIT_LNG, radius_km
        )

        # Walk the full circle at the exact radius.
        for step in range(72):
            bearing = math.radians(step * 5)
            # Slightly inside the radius to avoid floating-point edge noise.
            d = radius_km * 0.999
            lat = TU_RANGSIT_LAT + (d / 111.0) * math.cos(bearing)
            lng = TU_RANGSIT_LNG + (
                d / (111.0 * math.cos(math.radians(TU_RANGSIT_LAT)))
            ) * math.sin(bearing)

            assert min_lat <= lat <= max_lat, f"latitude clipped at bearing {step * 5}"
            assert min_lng <= lng <= max_lng, f"longitude clipped at bearing {step * 5}"

    def test_larger_radius_produces_larger_box(self):
        small = bounding_box(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 0.5)
        large = bounding_box(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0)
        assert large[0] < small[0]  # min_lat further south
        assert large[1] > small[1]  # max_lat further north
        assert large[2] < small[2]  # min_lng further west
        assert large[3] > small[3]  # max_lng further east

    def test_longitude_span_widens_away_from_equator(self):
        """Longitude degrees shrink with latitude, so the box must widen."""
        at_equator = bounding_box(0.0, 100.0, 3.0)
        at_bangkok = bounding_box(14.0, 100.0, 3.0)

        equator_span = at_equator[3] - at_equator[2]
        bangkok_span = at_bangkok[3] - at_bangkok[2]
        assert bangkok_span > equator_span

    def test_pole_does_not_divide_by_zero(self):
        min_lat, max_lat, min_lng, max_lng = bounding_box(90.0, 0.0, 3.0)
        assert min_lng == -180.0
        assert max_lng == 180.0
        assert max_lat > min_lat


class TestBucketRadius:
    @pytest.mark.parametrize(
        ("radius_km", "expected"),
        [
            (0.3, "0.5km"),
            (0.5, "0.5km"),
            (0.8, "1km"),
            (1.0, "1km"),
            (1.5, "1.5km"),
            (2.0, "2km"),
            (2.5, "3km"),
            (3.0, "3km"),
            (4.0, "5km"),
            (100.0, "50km"),
        ],
    )
    def test_buckets_match_expected_labels(self, radius_km, expected):
        assert _bucket_radius(radius_km) == expected

    @pytest.mark.parametrize("radius_km", [0.5, 1.0, 1.5, 2.0, 2.5, 3.0])
    def test_bucket_is_never_smaller_than_requested_radius(self, radius_km):
        """A bucket must be a superset of what the caller asked for.

        If the bucket were smaller, the cached set would be missing restaurants
        the caller legitimately needs.
        """
        label = _bucket_radius(radius_km)
        bucket_km = float(label.removesuffix("km"))
        assert bucket_km >= radius_km


class TestGenerateCacheKey:
    def test_is_stable_for_the_same_inputs(self):
        first = generate_cache_key(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, "Thai")
        second = generate_cache_key(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, "Thai")
        assert first == second

    def test_nearby_points_share_a_grid_cell(self):
        """Points within the same ~400 m cell must collapse to one key."""
        a = generate_cache_key(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0)
        b = generate_cache_key(TU_RANGSIT_LAT + 0.0005, TU_RANGSIT_LNG + 0.0005, 3.0)
        assert a == b

    def test_distant_points_get_different_keys(self):
        a = generate_cache_key(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0)
        b = generate_cache_key(TU_RANGSIT_LAT + 0.05, TU_RANGSIT_LNG, 3.0)
        assert a != b

    def test_category_is_part_of_the_key(self):
        with_category = generate_cache_key(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, "Thai")
        without = generate_cache_key(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, None)
        assert with_category != without
        assert without.endswith("_all")

    def test_documents_the_fragmentation_that_forced_distance_queries(self):
        """Two people on opposite sides of the campus get different keys.

        This is exactly why locally seeded data is queried by distance instead of
        by cache key — otherwise one of them would receive an empty deck.
        """
        north = generate_cache_key(TU_RANGSIT_LAT + 0.008, TU_RANGSIT_LNG, 3.0)
        south = generate_cache_key(TU_RANGSIT_LAT - 0.008, TU_RANGSIT_LNG, 3.0)
        assert north != south
