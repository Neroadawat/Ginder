"""Tests for the seed script's data derivation.

Focused on the parts that silently corrupt data when wrong: the OSM opening
hours parser, category classification, and the deterministic filler used for
fields OSM does not provide.
"""

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

# The seed script lives outside the app package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from seed_restaurants import (  # noqa: E402
    CATEGORY_CAFE,
    CATEGORY_DESSERT,
    CATEGORY_FAST_FOOD,
    CATEGORY_JAPANESE,
    CATEGORY_OTHER,
    CATEGORY_THAI,
    build_types,
    classify,
    generate_synthetic,
    parse_osm_opening_hours,
    parse_osm_price,
    synthesize_price_level,
    synthesize_rating,
    synthesize_ratings_total,
)

from app.utils.geo import calculate_distance_km  # noqa: E402
from app.utils.places import is_open_at  # noqa: E402

BANGKOK = ZoneInfo("Asia/Bangkok")

TU_RANGSIT_LAT = 14.0708
TU_RANGSIT_LNG = 100.6065


def bangkok(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=BANGKOK)


class TestClassify:
    def test_cuisine_tag_wins_over_amenity(self):
        category, specific = classify({"amenity": "restaurant", "cuisine": "thai"})
        assert category == CATEGORY_THAI
        assert specific == "thai_restaurant"

    def test_matches_inside_a_semicolon_list(self):
        """OSM often stores several cuisines in one tag."""
        category, _ = classify({"amenity": "restaurant", "cuisine": "noodle;thai"})
        assert category == CATEGORY_THAI

    def test_is_case_insensitive(self):
        category, _ = classify({"amenity": "restaurant", "cuisine": "JAPANESE"})
        assert category == CATEGORY_JAPANESE

    def test_falls_back_to_amenity_when_cuisine_is_absent(self):
        assert classify({"amenity": "cafe"})[0] == CATEGORY_CAFE
        assert classify({"amenity": "fast_food"})[0] == CATEGORY_FAST_FOOD
        assert classify({"amenity": "ice_cream"})[0] == CATEGORY_DESSERT

    def test_unknown_tags_land_in_other(self):
        assert classify({})[0] == CATEGORY_OTHER
        assert classify({"amenity": "spaceship"})[0] == CATEGORY_OTHER


class TestBuildTypes:
    def test_most_specific_type_comes_first(self):
        types = build_types("thai_restaurant", CATEGORY_THAI)
        assert types[0] == "thai_restaurant"

    def test_ends_with_the_generic_google_tail(self):
        types = build_types("coffee_shop", CATEGORY_CAFE)
        assert types[-3:] == ["food", "point_of_interest", "establishment"]

    def test_has_no_duplicates(self):
        """The specific type can equal the category type, e.g. cafe."""
        types = build_types("cafe", CATEGORY_CAFE)
        assert len(types) == len(set(types))


class TestSyntheticFillers:
    def test_price_is_stable_across_calls(self):
        """Re-running the seed must not reshuffle prices."""
        assert synthesize_price_level("ก๋วยเตี๋ยวเรือ") == synthesize_price_level(
            "ก๋วยเตี๋ยวเรือ"
        )

    def test_rating_is_stable_across_calls(self):
        assert synthesize_rating("ข้าวมันไก่") == synthesize_rating("ข้าวมันไก่")

    def test_different_names_can_differ(self):
        names = [f"Restaurant {i}" for i in range(40)]
        assert len({synthesize_price_level(n) for n in names}) > 1

    @pytest.mark.parametrize("name", [f"Place {i}" for i in range(30)])
    def test_price_stays_in_googles_range(self, name):
        assert 0 <= synthesize_price_level(name) <= 4

    @pytest.mark.parametrize("name", [f"Place {i}" for i in range(30)])
    def test_rating_stays_in_range(self, name):
        assert 0.0 <= synthesize_rating(name) <= 5.0

    @pytest.mark.parametrize("name", [f"Place {i}" for i in range(30)])
    def test_ratings_total_is_positive(self, name):
        assert synthesize_ratings_total(name) > 0

    def test_prices_skew_cheap_for_a_student_area(self):
        names = [f"Shop {i}" for i in range(200)]
        levels = [synthesize_price_level(n) for n in names]
        cheap = sum(1 for level in levels if level <= 1)
        assert cheap / len(levels) > 0.5


class TestParseOsmPrice:
    def test_reads_repeated_currency_symbols(self):
        assert parse_osm_price({"price_range": "฿฿"}) == 2

    def test_caps_at_googles_maximum(self):
        assert parse_osm_price({"price_range": "฿฿฿฿฿฿"}) == 4

    def test_absent_tag_returns_none(self):
        assert parse_osm_price({}) is None

    def test_unrecognised_format_returns_none(self):
        assert parse_osm_price({"price_range": "moderate"}) is None


class TestParseOsmOpeningHours:
    def test_empty_input_is_unknown(self):
        assert parse_osm_opening_hours(None) is None
        assert parse_osm_opening_hours("") is None
        assert parse_osm_opening_hours("   ") is None

    def test_24_7_is_always_open(self):
        hours = parse_osm_opening_hours("24/7")
        assert hours is not None
        # No `close` key means never closes.
        assert "close" not in hours["periods"][0]
        assert is_open_at(hours, bangkok(2026, 9, 7, 4)) is True

    def test_full_week_range(self):
        hours = parse_osm_opening_hours("Mo-Su 09:00-21:00")
        assert hours is not None
        assert len(hours["periods"]) == 7
        assert is_open_at(hours, bangkok(2026, 9, 7, 12)) is True
        assert is_open_at(hours, bangkok(2026, 9, 7, 7)) is False

    def test_bare_time_range_applies_to_every_day(self):
        hours = parse_osm_opening_hours("09:00-21:00")
        assert hours is not None
        assert len(hours["periods"]) == 7

    def test_weekday_range_excludes_the_weekend(self):
        hours = parse_osm_opening_hours("Mo-Fr 08:00-18:00")
        assert hours is not None
        assert len(hours["periods"]) == 5
        # Monday 7 Sept 2026.
        assert is_open_at(hours, bangkok(2026, 9, 7, 10)) is True
        # Saturday 12 Sept 2026.
        assert is_open_at(hours, bangkok(2026, 9, 12, 10)) is False

    def test_multiple_rules(self):
        hours = parse_osm_opening_hours("Mo-Fr 08:00-18:00; Sa 09:00-13:00")
        assert hours is not None
        assert len(hours["periods"]) == 6
        # Saturday morning is now covered.
        assert is_open_at(hours, bangkok(2026, 9, 12, 10)) is True
        # Saturday afternoon is not.
        assert is_open_at(hours, bangkok(2026, 9, 12, 15)) is False

    def test_comma_separated_days(self):
        hours = parse_osm_opening_hours("Mo,We,Fr 10:00-16:00")
        assert hours is not None
        assert len(hours["periods"]) == 3

    def test_day_range_wrapping_past_sunday(self):
        """Sa-Mo covers Saturday, Sunday and Monday."""
        hours = parse_osm_opening_hours("Sa-Mo 10:00-16:00")
        assert hours is not None
        assert len(hours["periods"]) == 3

    def test_single_day(self):
        hours = parse_osm_opening_hours("Su 11:00-15:00")
        assert hours is not None
        assert len(hours["periods"]) == 1
        # Sunday 6 Sept 2026.
        assert is_open_at(hours, bangkok(2026, 9, 6, 12)) is True

    @pytest.mark.parametrize(
        "raw",
        [
            "Mo-Fr sunrise-sunset",
            "Mo-Fr 08:00-18:00 || closed",
            "Apr-Sep 09:00-18:00",
            "Mo-Fr",
            "Xy 09:00-17:00",
            "09:00",
        ],
    )
    def test_unsupported_syntax_reports_unknown(self, raw):
        """Better to admit we could not parse it than to invent hours.

        Unknown hours are treated as open, so the place still appears
        (requirement 5.4).
        """
        assert parse_osm_opening_hours(raw) is None

    def test_one_bad_rule_invalidates_the_whole_string(self):
        """Half-parsed hours would be worse than no hours at all."""
        assert parse_osm_opening_hours("Mo-Fr 08:00-18:00; Sa sunrise-sunset") is None

    def test_result_is_consumable_by_is_open_at(self):
        """The parser's output must match what the filter expects."""
        hours = parse_osm_opening_hours("Mo-Su 00:00-24:00")
        assert hours is not None
        assert isinstance(is_open_at(hours, bangkok(2026, 9, 7, 12)), bool)


class TestGenerateSynthetic:
    def test_produces_the_requested_count(self):
        rows = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, 25)
        assert len(rows) == 25

    def test_every_venue_falls_inside_the_radius(self):
        radius = 3.0
        rows = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, radius, 60)
        for row in rows:
            distance = calculate_distance_km(
                TU_RANGSIT_LAT, TU_RANGSIT_LNG, row.latitude, row.longitude
            )
            assert distance <= radius + 0.01

    def test_place_ids_are_unique(self):
        rows = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, 60)
        assert len({row.place_id for row in rows}) == len(rows)

    def test_names_are_unique(self):
        """Branch suffixes must keep repeated base names distinct."""
        rows = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, 60)
        assert len({row.name for row in rows}) == len(rows)

    def test_is_reproducible(self):
        first = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, 20)
        second = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, 20)
        assert [r.latitude for r in first] == [r.latitude for r in second]
        assert [r.name for r in first] == [r.name for r in second]

    def test_every_row_has_the_fields_the_card_needs(self):
        rows = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, 10)
        for row in rows:
            assert row.place_id
            assert row.name
            assert row.primary_category
            assert row.types
            assert row.price_level is not None
            assert row.rating is not None
            assert row.google_maps_url.startswith("https://www.google.com/maps/dir/")

    def test_navigation_url_points_at_the_venue(self):
        rows = generate_synthetic(TU_RANGSIT_LAT, TU_RANGSIT_LNG, 3.0, 1)
        row = rows[0]
        assert f"destination={row.latitude},{row.longitude}" in row.google_maps_url
