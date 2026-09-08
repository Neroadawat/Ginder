#!/usr/bin/env python
"""Seed the restaurant table with Google Places-shaped rows.

Everything written here is flagged ``is_permanent`` so the nightly cache
cleanup leaves it alone (requirement 14.8).

Three sources:

``osm``
    Pull real venues from OpenStreetMap via the public Overpass API. Gives real
    names and coordinates, which is what makes radius filtering and distance
    maths testable. OSM has no photos or ratings and almost never has prices,
    so those are filled in deterministically (see :func:`synthesize_price_level`).

``csv``
    Import hand-curated rows. Use this for the places OSM does not know about —
    street carts, canteen stalls, the shops students actually eat at.

``generate``
    Pure synthetic venues scattered around the centre point. Offline fallback so
    the app is still testable with no network.

Examples::

    # Default: 3 km around Thammasat Rangsit
    python scripts/seed_restaurants.py

    # Replace everything currently seeded
    python scripts/seed_restaurants.py --clear

    # Preview without writing
    python scripts/seed_restaurants.py --dry-run

    # Import a curated sheet, keeping what is already there
    python scripts/seed_restaurants.py --source csv --file data/restaurants.csv

    # No network
    python scripts/seed_restaurants.py --source generate --count 60
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import math
import random
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import delete, select

# Allow running as a plain script from the backend/ directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Imported after the path fix so the script works without installing the package.
from app.core.database import async_session_factory  # noqa: E402
from app.models.restaurant import Restaurant  # noqa: E402
from app.utils.geo import calculate_distance_km  # noqa: E402
from app.utils.places import build_weekly_periods  # noqa: E402

# ─── Defaults: Thammasat University, Rangsit Campus (Khlong Luang, Pathum Thani) ───
# Verify against Google Maps if you want a different centre point.
DEFAULT_LATITUDE = 14.0708
DEFAULT_LONGITUDE = 100.6065
DEFAULT_RADIUS_KM = 3.0

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)

# OSM amenity values we treat as places to eat.
EATERY_AMENITIES = (
    "restaurant",
    "cafe",
    "fast_food",
    "food_court",
    "ice_cream",
    "bar",
    "pub",
)

# Display categories. Keep in sync with the Explore screen.
CATEGORY_THAI = "Thai"
CATEGORY_JAPANESE = "Japanese"
CATEGORY_KOREAN = "Korean"
CATEGORY_CHINESE = "Chinese"
CATEGORY_ITALIAN = "Italian"
CATEGORY_FAST_FOOD = "Fast Food"
CATEGORY_CAFE = "Cafe"
CATEGORY_DESSERT = "Dessert"
CATEGORY_OTHER = "Other"

# OSM `cuisine` fragment -> (display category, Google-style type).
# Matched as substrings because the tag is often a list like "thai;noodle".
CUISINE_MAP: tuple[tuple[str, str, str], ...] = (
    ("thai", CATEGORY_THAI, "thai_restaurant"),
    ("isan", CATEGORY_THAI, "thai_restaurant"),
    ("noodle", CATEGORY_THAI, "noodle_shop"),
    ("som_tam", CATEGORY_THAI, "thai_restaurant"),
    ("japanese", CATEGORY_JAPANESE, "japanese_restaurant"),
    ("sushi", CATEGORY_JAPANESE, "sushi_restaurant"),
    ("ramen", CATEGORY_JAPANESE, "ramen_restaurant"),
    ("korean", CATEGORY_KOREAN, "korean_restaurant"),
    ("chinese", CATEGORY_CHINESE, "chinese_restaurant"),
    ("dim_sum", CATEGORY_CHINESE, "chinese_restaurant"),
    ("italian", CATEGORY_ITALIAN, "italian_restaurant"),
    ("pizza", CATEGORY_ITALIAN, "pizza_restaurant"),
    ("pasta", CATEGORY_ITALIAN, "italian_restaurant"),
    ("burger", CATEGORY_FAST_FOOD, "hamburger_restaurant"),
    ("chicken", CATEGORY_FAST_FOOD, "fast_food_restaurant"),
    ("sandwich", CATEGORY_FAST_FOOD, "sandwich_shop"),
    ("coffee", CATEGORY_CAFE, "coffee_shop"),
    ("tea", CATEGORY_CAFE, "tea_house"),
    ("bubble_tea", CATEGORY_CAFE, "bubble_tea_store"),
    ("cake", CATEGORY_DESSERT, "dessert_shop"),
    ("dessert", CATEGORY_DESSERT, "dessert_shop"),
    ("ice_cream", CATEGORY_DESSERT, "ice_cream_shop"),
    ("bakery", CATEGORY_DESSERT, "bakery"),
)

# OSM amenity -> (display category, Google-style type).
AMENITY_MAP: dict[str, tuple[str, str]] = {
    "cafe": (CATEGORY_CAFE, "cafe"),
    "fast_food": (CATEGORY_FAST_FOOD, "fast_food_restaurant"),
    "ice_cream": (CATEGORY_DESSERT, "ice_cream_shop"),
    "restaurant": (CATEGORY_OTHER, "restaurant"),
    "food_court": (CATEGORY_OTHER, "food_court"),
    "bar": (CATEGORY_OTHER, "bar"),
    "pub": (CATEGORY_OTHER, "pub"),
}

# Category -> Google-style type, for curated and synthetic rows.
CATEGORY_TYPE: dict[str, str] = {
    CATEGORY_THAI: "thai_restaurant",
    CATEGORY_JAPANESE: "japanese_restaurant",
    CATEGORY_KOREAN: "korean_restaurant",
    CATEGORY_CHINESE: "chinese_restaurant",
    CATEGORY_ITALIAN: "italian_restaurant",
    CATEGORY_FAST_FOOD: "fast_food_restaurant",
    CATEGORY_CAFE: "cafe",
    CATEGORY_DESSERT: "dessert_shop",
    CATEGORY_OTHER: "restaurant",
}

# Generic tail Google appends to every eatery.
GENERIC_TYPES = ("restaurant", "food", "point_of_interest", "establishment")


@dataclass
class SeedRestaurant:
    """A restaurant row ready to be written to the database."""

    place_id: str
    name: str
    primary_category: str
    latitude: float
    longitude: float
    types: list[str] = field(default_factory=list)
    price_level: int | None = None
    rating: float | None = None
    user_ratings_total: int | None = None
    photo_url: str | None = None
    address: str | None = None
    opening_hours: dict[str, Any] | None = None

    @property
    def google_maps_url(self) -> str:
        """Turn-by-turn navigation link used by the post-match screen."""
        return (
            "https://www.google.com/maps/dir/?api=1"
            f"&destination={self.latitude},{self.longitude}"
        )


def build_types(specific: str, category: str) -> list[str]:
    """Assemble a Google-shaped `types` list, most specific first."""
    ordered: list[str] = []
    for candidate in (specific, CATEGORY_TYPE.get(category, "restaurant"), *GENERIC_TYPES):
        if candidate and candidate not in ordered:
            ordered.append(candidate)
    return ordered


# ─── Deterministic filler for fields the source does not provide ───


def _stable_unit(seed: str, salt: str) -> float:
    """Map a string to a stable float in [0, 1).

    Deterministic so re-running the seed does not reshuffle prices and ratings,
    which would make manual testing confusing.
    """
    digest = hashlib.sha256(f"{seed}:{salt}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def synthesize_price_level(name: str) -> int:
    """Assign a plausible Google price level (0-4), skewed cheap.

    A student neighbourhood is mostly ฿ and ฿฿, so the distribution leans low
    and never reaches 4.
    """
    roll = _stable_unit(name, "price")
    if roll < 0.30:
        return 0
    if roll < 0.62:
        return 1
    if roll < 0.90:
        return 2
    return 3


def synthesize_rating(name: str) -> float:
    """Assign a plausible rating between 3.4 and 4.9."""
    return round(3.4 + _stable_unit(name, "rating") * 1.5, 1)


def synthesize_ratings_total(name: str) -> int:
    """Assign a plausible review count between 12 and 900."""
    return 12 + int(_stable_unit(name, "ratings_total") * 888)


# ─── OSM opening hours ───

# OSM abbreviation -> Google day number (Sunday = 0).
_OSM_DAYS: dict[str, int] = {
    "su": 0,
    "mo": 1,
    "tu": 2,
    "we": 3,
    "th": 4,
    "fr": 5,
    "sa": 6,
}
_OSM_DAY_ORDER = ("mo", "tu", "we", "th", "fr", "sa", "su")

_TIME_RANGE = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")


def parse_osm_opening_hours(raw: str | None) -> dict[str, Any] | None:
    """Convert an OSM ``opening_hours`` string to Google ``periods``.

    OSM's syntax is a whole specification of its own; this handles the common
    shapes only:

    * ``24/7``
    * ``Mo-Su 09:00-21:00``
    * ``Mo-Fr 08:00-18:00; Sa 09:00-13:00``
    * ``09:00-21:00`` (no day part, assumed daily)

    Anything else returns None, which the "Open now" filter treats as "hours
    unknown, do not hide it" (requirement 5.4). Being honest about what we
    could not parse is better than inventing hours.
    """
    if not raw:
        return None

    text = raw.strip()
    if not text:
        return None

    if text in {"24/7", "24/7 open", "Mo-Su 00:00-24:00"}:
        # Google represents always-open as an `open` with no `close`.
        return {"periods": [{"open": {"day": 0, "time": "0000"}}]}

    periods: list[dict[str, Any]] = []

    for rule in text.split(";"):
        rule = rule.strip()
        if not rule:
            continue

        parsed = _parse_osm_rule(rule)
        if parsed is None:
            # One unparseable rule makes the whole string untrustworthy.
            return None
        periods.extend(parsed)

    return {"periods": periods} if periods else None


def _parse_osm_rule(rule: str) -> list[dict[str, Any]] | None:
    """Parse one ``Mo-Fr 08:00-18:00`` style rule."""
    parts = rule.split()

    if len(parts) == 1:
        day_spec, time_spec = None, parts[0]
    elif len(parts) == 2:
        day_spec, time_spec = parts
    else:
        return None

    match = _TIME_RANGE.match(time_spec)
    if not match:
        return None

    open_hour, open_minute, close_hour, close_minute = (int(g) for g in match.groups())
    if open_hour > 24 or close_hour > 24 or open_minute > 59 or close_minute > 59:
        return None

    open_time = f"{open_hour % 24:02d}{open_minute:02d}"
    close_time = f"{close_hour % 24:02d}{close_minute:02d}"

    days = _expand_day_spec(day_spec)
    if days is None:
        return None

    return [
        {
            "open": {"day": day, "time": open_time},
            "close": {"day": day, "time": close_time},
        }
        for day in days
    ]


def _expand_day_spec(day_spec: str | None) -> list[int] | None:
    """Expand ``Mo-Fr`` / ``Sa`` / ``Mo,We`` into Google day numbers."""
    if day_spec is None:
        return list(range(7))

    spec = day_spec.lower()
    days: list[int] = []

    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue

        if "-" in chunk:
            start, _, end = chunk.partition("-")
            if start not in _OSM_DAYS or end not in _OSM_DAYS:
                return None
            days.extend(_day_range(start, end))
        else:
            if chunk not in _OSM_DAYS:
                return None
            days.append(_OSM_DAYS[chunk])

    return sorted(set(days)) or None


def _day_range(start: str, end: str) -> list[int]:
    """Inclusive weekday range following OSM's Monday-first ordering."""
    start_index = _OSM_DAY_ORDER.index(start)
    end_index = _OSM_DAY_ORDER.index(end)

    if start_index <= end_index:
        span = _OSM_DAY_ORDER[start_index : end_index + 1]
    else:
        span = _OSM_DAY_ORDER[start_index:] + _OSM_DAY_ORDER[: end_index + 1]

    return [_OSM_DAYS[day] for day in span]


# ─── OSM / Overpass ───


def build_overpass_query(latitude: float, longitude: float, radius_km: float) -> str:
    """Build an Overpass QL query for eateries within a radius.

    ``out center`` makes Overpass emit a centre coordinate for ways (buildings),
    so nodes and ways can be handled identically.
    """
    radius_m = int(radius_km * 1000)
    amenity_regex = "|".join(EATERY_AMENITIES)
    around = f"(around:{radius_m},{latitude},{longitude})"

    return f"""
[out:json][timeout:90];
(
  node["amenity"~"^({amenity_regex})$"]{around};
  way["amenity"~"^({amenity_regex})$"]{around};
);
out center tags;
""".strip()


async def fetch_from_osm(
    latitude: float, longitude: float, radius_km: float
) -> list[SeedRestaurant]:
    """Query Overpass and convert the response into seed rows.

    Tries each mirror in turn — the main endpoint rate-limits aggressively.
    """
    query = build_overpass_query(latitude, longitude, radius_km)
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=120.0) as client:
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                print(f"  querying {endpoint} ...")
                response = await client.post(endpoint, data={"data": query})
                response.raise_for_status()
                elements = response.json().get("elements", [])
                print(f"  Overpass returned {len(elements)} raw elements")
                return _parse_osm_elements(elements)
            except Exception as exc:  # noqa: BLE001 - try the next mirror
                last_error = exc
                print(f"  failed: {exc}")

    raise RuntimeError(
        f"All Overpass endpoints failed. Last error: {last_error}. "
        "Use --source generate to seed without network access."
    )


def _parse_osm_elements(elements: list[dict]) -> list[SeedRestaurant]:
    """Convert raw Overpass elements into seed rows, skipping unusable ones."""
    results: list[SeedRestaurant] = []
    skipped_unnamed = 0
    unparsed_hours = 0

    for element in elements:
        tags = element.get("tags") or {}

        name = (tags.get("name:en") or tags.get("name") or "").strip()
        if not name:
            # An unnamed pin is useless on a swipe card.
            skipped_unnamed += 1
            continue

        # Nodes carry lat/lon directly; ways carry it under "center".
        latitude = element.get("lat") or (element.get("center") or {}).get("lat")
        longitude = element.get("lon") or (element.get("center") or {}).get("lon")
        if latitude is None or longitude is None:
            continue

        category, specific_type = classify(tags)
        opening_hours = parse_osm_opening_hours(tags.get("opening_hours"))
        if tags.get("opening_hours") and opening_hours is None:
            unparsed_hours += 1

        results.append(
            SeedRestaurant(
                place_id=f"osm:{element.get('type')}/{element.get('id')}",
                name=name,
                primary_category=category,
                types=build_types(specific_type, category),
                latitude=float(latitude),
                longitude=float(longitude),
                price_level=parse_osm_price(tags) or synthesize_price_level(name),
                rating=synthesize_rating(name),
                user_ratings_total=synthesize_ratings_total(name),
                address=build_address(tags),
                opening_hours=opening_hours,
            )
        )

    if skipped_unnamed:
        print(f"  skipped {skipped_unnamed} unnamed places")
    if unparsed_hours:
        print(
            f"  {unparsed_hours} place(s) had opening hours in a format we do not "
            "parse; stored as unknown so 'Open now' will not hide them"
        )

    return results


def classify(tags: dict[str, str]) -> tuple[str, str]:
    """Derive ``(primary_category, specific_type)`` from OSM tags.

    Prefers the ``cuisine`` tag and falls back to ``amenity``. This mapping runs
    once here at ingest, never in queries or UI (requirement 14.4).
    """
    cuisine = (tags.get("cuisine") or "").lower()
    for fragment, category, specific_type in CUISINE_MAP:
        if fragment in cuisine:
            return category, specific_type

    return AMENITY_MAP.get(tags.get("amenity", ""), (CATEGORY_OTHER, "restaurant"))


def parse_osm_price(tags: dict[str, str]) -> int | None:
    """Read a price level from OSM if one happens to be tagged.

    Almost always absent, which is exactly why synthetic prices exist.
    """
    raw = (tags.get("price_range") or tags.get("price") or "").strip()
    if not raw:
        return None

    for symbol in ("฿", "$", "€"):
        if raw.startswith(symbol):
            return min(raw.count(symbol), 4)

    return None


def build_address(tags: dict[str, str]) -> str | None:
    """Assemble a readable address from OSM address tags."""
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:subdistrict"),
        tags.get("addr:district"),
        tags.get("addr:city"),
        tags.get("addr:province"),
    ]
    joined = " ".join(p for p in parts if p)
    return joined or None


# ─── CSV ───

CSV_COLUMNS = (
    "name",
    "category",
    "latitude",
    "longitude",
    "price_level",
    "rating",
    "user_ratings_total",
    "address",
    "photo_url",
    "opens",
    "closes",
)


def load_from_csv(path: Path) -> list[SeedRestaurant]:
    """Read curated restaurants from a CSV file.

    Required columns: ``name``, ``latitude``, ``longitude``.
    Everything else is optional and filled in when blank. ``opens``/``closes``
    take ``HH:MM`` and apply to every day of the week.
    """
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")

    results: list[SeedRestaurant] = []

    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)

        missing = {"name", "latitude", "longitude"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing required column(s): {sorted(missing)}")

        for line_number, row in enumerate(reader, start=2):
            name = (row.get("name") or "").strip()
            if not name:
                print(f"  line {line_number}: blank name, skipped")
                continue

            try:
                latitude = float(row["latitude"])
                longitude = float(row["longitude"])
            except (TypeError, ValueError):
                print(f"  line {line_number}: bad coordinates for {name!r}, skipped")
                continue

            category = (row.get("category") or "").strip() or CATEGORY_OTHER
            price_level = _optional_int(row.get("price_level"))
            if price_level is not None:
                price_level = max(0, min(4, price_level))

            results.append(
                SeedRestaurant(
                    place_id=f"manual:{_slugify(name)}",
                    name=name,
                    primary_category=category,
                    types=build_types(CATEGORY_TYPE.get(category, "restaurant"), category),
                    latitude=latitude,
                    longitude=longitude,
                    price_level=(
                        price_level if price_level is not None else synthesize_price_level(name)
                    ),
                    rating=_optional_float(row.get("rating")) or synthesize_rating(name),
                    user_ratings_total=(
                        _optional_int(row.get("user_ratings_total"))
                        or synthesize_ratings_total(name)
                    ),
                    address=(row.get("address") or "").strip() or None,
                    photo_url=(row.get("photo_url") or "").strip() or None,
                    opening_hours=_hours_from_csv(row.get("opens"), row.get("closes")),
                )
            )

    return results


def _hours_from_csv(opens: str | None, closes: str | None) -> dict[str, Any] | None:
    """Build daily opening periods from ``HH:MM`` strings."""
    open_time = _to_hhmm(opens)
    close_time = _to_hhmm(closes)
    if not open_time or not close_time:
        return None
    return build_weekly_periods(open_time, close_time)


def _to_hhmm(raw: str | None) -> str | None:
    """Normalise ``H:MM`` or ``HH:MM`` into ``HHMM``."""
    if not raw:
        return None
    text = raw.strip()
    if ":" not in text:
        return None
    hour, _, minute = text.partition(":")
    if not hour.isdigit() or not minute.isdigit():
        return None
    return f"{int(hour) % 24:02d}{int(minute) % 60:02d}"


def _slugify(value: str) -> str:
    """Make a stable, compact identifier fragment from a name."""
    collapsed = re.sub(r"\s+", "-", value.strip())
    return collapsed[:120]


def _optional_int(raw: str | None) -> int | None:
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return None


def _optional_float(raw: str | None) -> float | None:
    try:
        return float(str(raw).strip())
    except (TypeError, ValueError):
        return None


def write_csv_template(path: Path) -> None:
    """Write an empty CSV with the expected header, plus one example row."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerow(
            {
                "name": "ร้านตัวอย่าง หน้าประตูเชียงราก",
                "category": CATEGORY_THAI,
                "latitude": DEFAULT_LATITUDE,
                "longitude": DEFAULT_LONGITUDE,
                "price_level": 1,
                "rating": 4.5,
                "user_ratings_total": 120,
                "address": "",
                "photo_url": "",
                "opens": "08:00",
                "closes": "20:00",
            }
        )


# ─── Synthetic generator (offline fallback) ───

SYNTHETIC_NAMES: tuple[tuple[str, str], ...] = (
    ("ก๋วยเตี๋ยวเรือ", CATEGORY_THAI),
    ("ข้าวมันไก่", CATEGORY_THAI),
    ("ส้มตำแซ่บ", CATEGORY_THAI),
    ("ผัดไทยโบราณ", CATEGORY_THAI),
    ("ข้าวกะเพราหมูสับ", CATEGORY_THAI),
    ("ราเมนต้นตำรับ", CATEGORY_JAPANESE),
    ("ซูชิคำโต", CATEGORY_JAPANESE),
    ("ข้าวหน้าเนื้อ", CATEGORY_JAPANESE),
    ("หมูกระทะเกาหลี", CATEGORY_KOREAN),
    ("ต๊อกบกกีชีสยืด", CATEGORY_KOREAN),
    ("ติ่มซำเช้า", CATEGORY_CHINESE),
    ("บะหมี่เป็ดย่าง", CATEGORY_CHINESE),
    ("พิซซ่าเตาถ่าน", CATEGORY_ITALIAN),
    ("สปาเกตตีคาโบนารา", CATEGORY_ITALIAN),
    ("เบอร์เกอร์เนื้อฉ่ำ", CATEGORY_FAST_FOOD),
    ("ไก่ทอดกรอบ", CATEGORY_FAST_FOOD),
    ("กาแฟดริปหอม", CATEGORY_CAFE),
    ("ชานมไข่มุก", CATEGORY_CAFE),
    ("บิงซูสตรอว์เบอร์รี", CATEGORY_DESSERT),
    ("โรตีกล้วยหอม", CATEGORY_DESSERT),
)


def generate_synthetic(
    latitude: float, longitude: float, radius_km: float, count: int
) -> list[SeedRestaurant]:
    """Scatter synthetic restaurants uniformly inside the radius."""
    rng = random.Random(f"ginder:{latitude}:{longitude}:{count}")
    results: list[SeedRestaurant] = []

    for index in range(count):
        base_name, category = SYNTHETIC_NAMES[index % len(SYNTHETIC_NAMES)]
        suffix = index // len(SYNTHETIC_NAMES) + 1
        name = base_name if suffix == 1 else f"{base_name} สาขา {suffix}"

        # sqrt keeps points uniform by area rather than clustered at the centre.
        distance_km = radius_km * math.sqrt(rng.random())
        bearing = rng.uniform(0, 2 * math.pi)

        delta_lat = (distance_km / 111.0) * math.cos(bearing)
        delta_lng = (distance_km / (111.0 * math.cos(math.radians(latitude)))) * math.sin(
            bearing
        )

        results.append(
            SeedRestaurant(
                place_id=f"synthetic:{index}",
                name=name,
                primary_category=category,
                types=build_types(CATEGORY_TYPE.get(category, "restaurant"), category),
                latitude=round(latitude + delta_lat, 6),
                longitude=round(longitude + delta_lng, 6),
                price_level=synthesize_price_level(name),
                rating=synthesize_rating(name),
                user_ratings_total=synthesize_ratings_total(name),
                opening_hours=build_weekly_periods("0900", "2100"),
            )
        )

    return results


# ─── Persistence ───


def deduplicate(rows: list[SeedRestaurant]) -> list[SeedRestaurant]:
    """Drop repeats.

    Overpass can return the same venue as both a node and a building way, and a
    CSV may be re-imported.
    """
    seen: set[str] = set()
    unique: list[SeedRestaurant] = []

    for row in rows:
        if row.place_id in seen:
            continue
        seen.add(row.place_id)
        unique.append(row)

    dropped = len(rows) - len(unique)
    if dropped:
        print(f"  removed {dropped} duplicate(s)")

    return unique


def filter_to_radius(
    rows: list[SeedRestaurant], latitude: float, longitude: float, radius_km: float
) -> list[SeedRestaurant]:
    """Drop rows outside the radius.

    Overpass ``around`` is already circular, but a CSV can contain anything.
    """
    inside = [
        row
        for row in rows
        if calculate_distance_km(latitude, longitude, row.latitude, row.longitude) <= radius_km
    ]

    dropped = len(rows) - len(inside)
    if dropped:
        print(f"  removed {dropped} row(s) outside {radius_km} km")

    return inside


async def persist(rows: list[SeedRestaurant], clear_existing: bool) -> tuple[int, int]:
    """Upsert rows by ``place_id``. Returns ``(inserted, updated)``.

    Everything written is marked permanent with no expiry, so the nightly cache
    cleanup skips it (requirement 14.8).
    """
    inserted = 0
    updated = 0

    async with async_session_factory() as session:
        if clear_existing:
            result = await session.execute(delete(Restaurant))
            print(f"  cleared {result.rowcount or 0} existing restaurant(s)")

        for row in rows:
            existing = None
            if not clear_existing:
                existing = (
                    await session.execute(
                        select(Restaurant).where(Restaurant.place_id == row.place_id)
                    )
                ).scalar_one_or_none()

            if existing is None:
                session.add(
                    Restaurant(
                        place_id=row.place_id,
                        name=row.name,
                        primary_category=row.primary_category,
                        types=row.types,
                        latitude=row.latitude,
                        longitude=row.longitude,
                        price_level=row.price_level,
                        rating=row.rating,
                        user_ratings_total=row.user_ratings_total,
                        opening_hours=row.opening_hours,
                        photo_url=row.photo_url,
                        address=row.address,
                        google_maps_url=row.google_maps_url,
                        is_permanent=True,
                        expires_at=None,
                        cache_key=None,
                    )
                )
                inserted += 1
            else:
                existing.name = row.name
                existing.primary_category = row.primary_category
                existing.types = row.types
                existing.latitude = row.latitude
                existing.longitude = row.longitude
                existing.price_level = row.price_level
                existing.rating = row.rating
                existing.user_ratings_total = row.user_ratings_total
                existing.opening_hours = row.opening_hours
                existing.address = row.address
                existing.google_maps_url = row.google_maps_url
                existing.is_permanent = True
                existing.expires_at = None
                # Never overwrite a curated photo with nothing.
                if row.photo_url:
                    existing.photo_url = row.photo_url
                updated += 1

        await session.commit()

    return inserted, updated


def summarize(rows: list[SeedRestaurant]) -> None:
    """Print a category and price breakdown."""
    if not rows:
        return

    by_category: dict[str, int] = {}
    by_price: dict[int | None, int] = {}
    with_hours = 0

    for row in rows:
        by_category[row.primary_category] = by_category.get(row.primary_category, 0) + 1
        by_price[row.price_level] = by_price.get(row.price_level, 0) + 1
        if row.opening_hours:
            with_hours += 1

    print("\n  By category:")
    for category, count in sorted(by_category.items(), key=lambda kv: -kv[1]):
        print(f"    {category:<12} {count}")

    print("\n  By price level:")
    for level in (0, 1, 2, 3, 4, None):
        if level in by_price:
            label = f"{level} ({'฿' * max(level, 1)})" if level is not None else "unknown"
            print(f"    {label:<12} {by_price[level]}")

    print(f"\n  With opening hours: {with_hours}/{len(rows)}")


# ─── CLI ───


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed restaurants around a centre point.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--source",
        choices=("osm", "csv", "generate"),
        default="osm",
        help="Where to get restaurants from (default: osm)",
    )
    parser.add_argument("--file", type=Path, help="CSV path, required for --source csv")
    parser.add_argument("--lat", type=float, default=DEFAULT_LATITUDE, help="Centre latitude")
    parser.add_argument("--lng", type=float, default=DEFAULT_LONGITUDE, help="Centre longitude")
    parser.add_argument(
        "--radius", type=float, default=DEFAULT_RADIUS_KM, help="Radius in km"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=60,
        help="How many venues to invent, for --source generate",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete all existing restaurants before inserting",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Show what would happen, write nothing"
    )
    parser.add_argument(
        "--write-csv-template",
        type=Path,
        help="Write a blank CSV template to this path and exit",
    )
    return parser.parse_args()


async def main() -> int:
    args = parse_args()

    if args.write_csv_template:
        write_csv_template(args.write_csv_template)
        print(f"Wrote CSV template to {args.write_csv_template}")
        return 0

    print(
        f"Seeding from '{args.source}' — centre ({args.lat}, {args.lng}), "
        f"radius {args.radius} km"
    )

    if args.source == "osm":
        rows = await fetch_from_osm(args.lat, args.lng, args.radius)
    elif args.source == "csv":
        if not args.file:
            print("error: --file is required with --source csv", file=sys.stderr)
            return 2
        rows = load_from_csv(args.file)
    else:
        rows = generate_synthetic(args.lat, args.lng, args.radius, args.count)

    print(f"  collected {len(rows)} candidate(s)")

    rows = deduplicate(rows)
    rows = filter_to_radius(rows, args.lat, args.lng, args.radius)

    if not rows:
        print(
            "\nNo restaurants to seed. OSM coverage here may be thin — try "
            "--source generate, or curate a CSV with --write-csv-template."
        )
        return 1

    print(f"\n{len(rows)} restaurant(s) ready")
    summarize(rows)

    if args.dry_run:
        print("\n  Sample:")
        for row in rows[:10]:
            price = "฿" * max(row.price_level or 0, 1)
            print(
                f"    {row.name[:32]:<32} {row.primary_category:<11} "
                f"{price:<5} {row.rating}  ({row.latitude:.5f}, {row.longitude:.5f})"
            )
        print("\nDry run — nothing written.")
        return 0

    inserted, updated = await persist(rows, args.clear)
    print(f"\nDone. Inserted {inserted}, updated {updated}. All marked permanent.")

    if len(rows) < 20:
        print(
            "\nHeads up: fewer than 20 restaurants. The deck will feel thin. "
            "Consider adding curated rows:\n"
            "  python scripts/seed_restaurants.py --write-csv-template data/restaurants.csv\n"
            "  python scripts/seed_restaurants.py --source csv --file data/restaurants.csv"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
