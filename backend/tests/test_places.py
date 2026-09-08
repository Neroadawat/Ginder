"""Tests for price-level mapping and opening-hours evaluation."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.utils.places import (
    build_weekly_periods,
    is_open_at,
    price_level_to_symbol,
    price_tier_to_levels,
)

BANGKOK = ZoneInfo("Asia/Bangkok")

# Google Places uses Sunday = 0, so these are the days we care about.
SUNDAY = 0
MONDAY = 1
FRIDAY = 5
SATURDAY = 6


def bangkok(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=BANGKOK)


class TestPriceLevelToSymbol:
    @pytest.mark.parametrize(
        ("level", "expected"),
        [
            (0, "฿"),
            (1, "฿"),
            (2, "฿฿"),
            (3, "฿฿฿"),
            (4, "฿฿฿"),
        ],
    )
    def test_maps_googles_five_levels_onto_three_tiers(self, level, expected):
        assert price_level_to_symbol(level) == expected

    def test_unknown_price_has_no_symbol(self):
        assert price_level_to_symbol(None) is None

    @pytest.mark.parametrize("level", [-5, 99])
    def test_out_of_range_values_are_clamped(self, level):
        """Bad provider data should still render rather than crash."""
        assert price_level_to_symbol(level) in {"฿", "฿฿฿"}


class TestPriceTierToLevels:
    def test_cheapest_tier_covers_free_and_inexpensive(self):
        """Tier 1 must match both 0 and 1, or free places would be unreachable."""
        assert price_tier_to_levels(1) == [0, 1]

    def test_middle_tier_is_exact(self):
        assert price_tier_to_levels(2) == [2]

    def test_top_tier_covers_expensive_and_very_expensive(self):
        assert price_tier_to_levels(3) == [3, 4]

    @pytest.mark.parametrize("tier", [0, 4, -1])
    def test_unknown_tier_matches_nothing(self, tier):
        assert price_tier_to_levels(tier) == []

    def test_every_google_level_is_reachable(self):
        """No stored price_level may be impossible to filter for."""
        covered = set()
        for tier in (1, 2, 3):
            covered.update(price_tier_to_levels(tier))
        assert covered == {0, 1, 2, 3, 4}

    def test_tiers_do_not_overlap(self):
        """A restaurant must not appear under two different price chips."""
        tier_sets = [set(price_tier_to_levels(t)) for t in (1, 2, 3)]
        assert tier_sets[0].isdisjoint(tier_sets[1])
        assert tier_sets[1].isdisjoint(tier_sets[2])
        assert tier_sets[0].isdisjoint(tier_sets[2])


class TestIsOpenAt:
    def test_missing_hours_counts_as_open(self):
        """Requirement 5.4: incomplete data must not hide a restaurant."""
        moment = bangkok(2026, 9, 7, 12)
        assert is_open_at(None, moment) is True
        assert is_open_at({}, moment) is True
        assert is_open_at({"periods": []}, moment) is True

    def test_inside_a_normal_window(self):
        hours = build_weekly_periods("0900", "2100")
        # 7 Sept 2026 is a Monday.
        assert is_open_at(hours, bangkok(2026, 9, 7, 12)) is True

    def test_before_opening(self):
        hours = build_weekly_periods("0900", "2100")
        assert is_open_at(hours, bangkok(2026, 9, 7, 8, 59)) is False

    def test_exactly_at_opening_time_is_open(self):
        hours = build_weekly_periods("0900", "2100")
        assert is_open_at(hours, bangkok(2026, 9, 7, 9, 0)) is True

    def test_exactly_at_closing_time_is_closed(self):
        """The close time is exclusive, so 21:00 is already shut."""
        hours = build_weekly_periods("0900", "2100")
        assert is_open_at(hours, bangkok(2026, 9, 7, 21, 0)) is False

    def test_after_closing(self):
        hours = build_weekly_periods("0900", "2100")
        assert is_open_at(hours, bangkok(2026, 9, 7, 22)) is False

    def test_open_only_on_a_specific_day(self):
        hours = {
            "periods": [
                {"open": {"day": MONDAY, "time": "0900"},
                 "close": {"day": MONDAY, "time": "1700"}}
            ]
        }
        # Monday at noon.
        assert is_open_at(hours, bangkok(2026, 9, 7, 12)) is True
        # Sunday at noon.
        assert is_open_at(hours, bangkok(2026, 9, 6, 12)) is False

    def test_missing_close_means_always_open(self):
        """Google omits `close` for places that never shut."""
        hours = {"periods": [{"open": {"day": SUNDAY, "time": "0000"}}]}
        assert is_open_at(hours, bangkok(2026, 9, 7, 3)) is True
        assert is_open_at(hours, bangkok(2026, 9, 10, 23, 59)) is True

    def test_window_crossing_midnight_late_evening(self):
        """Open Friday 18:00, closes Saturday 02:00."""
        hours = {
            "periods": [
                {"open": {"day": FRIDAY, "time": "1800"},
                 "close": {"day": SATURDAY, "time": "0200"}}
            ]
        }
        # Friday 23:00 — 11 Sept 2026 is a Friday.
        assert is_open_at(hours, bangkok(2026, 9, 11, 23)) is True

    def test_window_crossing_midnight_early_morning(self):
        hours = {
            "periods": [
                {"open": {"day": FRIDAY, "time": "1800"},
                 "close": {"day": SATURDAY, "time": "0200"}}
            ]
        }
        # Saturday 01:00, still inside the window that began on Friday.
        assert is_open_at(hours, bangkok(2026, 9, 12, 1)) is True

    def test_outside_a_midnight_crossing_window(self):
        hours = {
            "periods": [
                {"open": {"day": FRIDAY, "time": "1800"},
                 "close": {"day": SATURDAY, "time": "0200"}}
            ]
        }
        # Saturday 03:00, an hour after closing.
        assert is_open_at(hours, bangkok(2026, 9, 12, 3)) is False
        # Friday lunchtime, before opening.
        assert is_open_at(hours, bangkok(2026, 9, 11, 12)) is False

    def test_multiple_windows_in_one_day(self):
        """Split shifts: lunch, then dinner."""
        hours = {
            "periods": [
                {"open": {"day": MONDAY, "time": "1100"},
                 "close": {"day": MONDAY, "time": "1400"}},
                {"open": {"day": MONDAY, "time": "1700"},
                 "close": {"day": MONDAY, "time": "2200"}},
            ]
        }
        assert is_open_at(hours, bangkok(2026, 9, 7, 12)) is True
        # The gap between shifts.
        assert is_open_at(hours, bangkok(2026, 9, 7, 15)) is False
        assert is_open_at(hours, bangkok(2026, 9, 7, 20)) is True

    def test_malformed_time_is_ignored_rather_than_crashing(self):
        hours = {
            "periods": [
                {"open": {"day": MONDAY, "time": "abcd"},
                 "close": {"day": MONDAY, "time": "1700"}}
            ]
        }
        assert is_open_at(hours, bangkok(2026, 9, 7, 12)) is False

    def test_period_without_open_is_ignored(self):
        hours = {"periods": [{"close": {"day": MONDAY, "time": "1700"}}]}
        assert is_open_at(hours, bangkok(2026, 9, 7, 12)) is False


class TestBuildWeeklyPeriods:
    def test_covers_all_seven_days(self):
        hours = build_weekly_periods("0800", "2000")
        days = {period["open"]["day"] for period in hours["periods"]}
        assert days == set(range(7))

    def test_is_open_on_every_day_of_the_week(self):
        hours = build_weekly_periods("0800", "2000")
        # 7-13 Sept 2026 is a full Monday-to-Sunday week.
        for day in range(7, 14):
            assert is_open_at(hours, bangkok(2026, 9, day, 12)) is True
