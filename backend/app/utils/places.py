"""Helpers for interpreting Google Places-shaped restaurant data.

Two concerns live here:

* Turning a 0-4 ``price_level`` into the ฿ symbols the UI shows.
* Deciding whether a place is open right now from its ``periods``.

Both are pure functions so they can be tested without a database.
"""

from datetime import datetime, time
from typing import Any
from zoneinfo import ZoneInfo

# ─── Price level ───

# Google's scale is 0-4; the app displays three tiers (requirement 5.2, 14.5).
# 0 (free) and 1 (inexpensive) both read as a single ฿, while 3 (expensive) and
# 4 (very expensive) both read as ฿฿฿.
_PRICE_SYMBOLS: dict[int, str] = {
    0: "฿",
    1: "฿",
    2: "฿฿",
    3: "฿฿฿",
    4: "฿฿฿",
}

MIN_PRICE_LEVEL = 0
MAX_PRICE_LEVEL = 4


def price_level_to_symbol(price_level: int | None) -> str | None:
    """Render a 0-4 price level as ฿ symbols. Returns None when unknown."""
    if price_level is None:
        return None
    clamped = max(MIN_PRICE_LEVEL, min(MAX_PRICE_LEVEL, price_level))
    return _PRICE_SYMBOLS[clamped]


def price_tier_to_levels(tier: int) -> list[int]:
    """Expand a displayed tier (1, 2 or 3) into the raw levels it covers.

    The UI offers three price chips but the database stores Google's five
    values, so filtering on "฿" has to match both 0 and 1.
    """
    if tier == 1:
        return [0, 1]
    if tier == 2:
        return [2]
    if tier == 3:
        return [3, 4]
    return []


# ─── Opening hours ───

# Google Places uses 0 = Sunday through 6 = Saturday.
_GOOGLE_SUNDAY = 0
_DAYS_IN_WEEK = 7


def is_open_at(opening_hours: dict[str, Any] | None, moment: datetime) -> bool:
    """Return whether a place is open at ``moment``.

    ``opening_hours`` follows the Google Places shape::

        {"periods": [{"open":  {"day": 1, "time": "0800"},
                      "close": {"day": 1, "time": "2000"}}]}

    Places with no hours recorded are treated as open, so the "Open now"
    filter never hides a restaurant purely because its data is incomplete
    (requirement 5.4).

    A period with an ``open`` but no ``close`` means open 24/7, which is how
    Google represents always-open places.
    """
    if not opening_hours:
        return True

    periods = opening_hours.get("periods")
    if not periods:
        return True

    # Convert Python's Monday=0 convention to Google's Sunday=0.
    current_day = (moment.weekday() + 1) % _DAYS_IN_WEEK
    current_time = moment.time()

    for period in periods:
        if _period_covers(period, current_day, current_time):
            return True

    return False


def _period_covers(period: dict[str, Any], day: int, moment: time) -> bool:
    """Check a single opening period, handling windows that cross midnight."""
    open_spec = period.get("open")
    if not open_spec:
        return False

    open_day = open_spec.get("day")
    open_time = _parse_hhmm(open_spec.get("time"))
    if open_day is None or open_time is None:
        return False

    close_spec = period.get("close")
    if not close_spec:
        # Google omits `close` for places that never close.
        return True

    close_day = close_spec.get("day")
    close_time = _parse_hhmm(close_spec.get("time"))
    if close_day is None or close_time is None:
        return True

    same_day_window = open_day == close_day and open_time <= close_time

    if same_day_window:
        return day == open_day and open_time <= moment < close_time

    # The window runs past midnight, e.g. open Fri 18:00, close Sat 02:00.
    if day == open_day:
        return moment >= open_time
    if day == close_day:
        return moment < close_time

    # Spans one or more whole days in between (rare but valid).
    return _day_is_between(day, open_day, close_day)


def _day_is_between(day: int, start: int, end: int) -> bool:
    """Whether ``day`` falls strictly inside a wrapping day range."""
    cursor = (start + 1) % _DAYS_IN_WEEK
    while cursor != end:
        if cursor == day:
            return True
        cursor = (cursor + 1) % _DAYS_IN_WEEK
    return False


def _parse_hhmm(raw: str | None) -> time | None:
    """Parse Google's ``"HHMM"`` time string."""
    if not raw or len(raw) != 4 or not raw.isdigit():
        return None

    hour = int(raw[:2])
    minute = int(raw[2:])
    if hour > 23 or minute > 59:
        return None

    return time(hour=hour, minute=minute)


def now_in_timezone(timezone_name: str) -> datetime:
    """Current local time in the given IANA timezone.

    Opening hours are expressed in the restaurant's local time, so "open now"
    has to be evaluated there rather than in UTC.
    """
    return datetime.now(ZoneInfo(timezone_name))


def build_weekly_periods(open_time: str, close_time: str) -> dict[str, Any]:
    """Build a Google-shaped ``periods`` block for the same hours every day.

    Convenience for seeding mock data.
    """
    return {
        "periods": [
            {
                "open": {"day": day, "time": open_time},
                "close": {"day": day, "time": close_time},
            }
            for day in range(_DAYS_IN_WEEK)
        ]
    }
