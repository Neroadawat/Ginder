#!/usr/bin/env python
"""Seed the restaurant table.

Three sources:

``osm``
    Pull real venues from OpenStreetMap via the public Overpass API. Gives real
    names and coordinates, which is what makes radius filtering and distance
    maths testable. OSM has no photos or ratings and almost never has prices,
    so those get filled in deterministically (see :func:`synthesize_price_level`).

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
import sys
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from sqlalchemy import delete, select

# Allow running as a plain script from the backend/ directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import async_session_factory  # noqa: E402
from app.models.restaurant import Restaurant  # noqa: E402
from app.utils.geo import calculate_distance_km, generate_cache_key  # noqa: E402

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

# Categories the app displays. Keep in sync with the Explore screen.
CATEGORY_THAI = "Thai"
CATEGORY_JAPANESE = "Japanese"
CATEGORY_KOREAN = "Korean"
CATEGORY_CHINESE = "Chinese"
CATEGORY_ITALIAN = "Italian"
CATEGORY_FAST_FOOD = "Fast Food"
CATEGORY_CAFE = "Cafe"
CATEGORY_DESSERT = "Dessert"
CATEGORY_OTHER = "Other"

# OSM `cuisine` tag fragment -> our category. Checked as substrings because the
# tag is often a semicolon-separated list like "thai;noodle".
CUISINE_MAP: tuple[tuple[str, str], ...] = (
    ("thai", CATEGORY_THAI),
    ("isan", CATEGORY_THAI),
    ("noodle", CATEGORY_THAI),
    ("som_tam", CATEGORY_THAI),
    ("japanese", CATEGORY_JAPANESE),
    ("sushi", CATEGORY_JAPANESE),
    ("ramen", CATEGORY_JAPANESE),
    ("korean", CATEGORY_KOREAN),
    ("chinese", CATEGORY_CHINESE),
    ("dim_sum", CATEGORY_CHINESE),
    ("italian", CATEGORY_ITALIAN),
    ("pizza", CATEGORY_ITALIAN),
    ("pasta", CATEGORY_ITALIAN),
    ("burger", CATEGORY_FAST_FOOD),
    ("chicken", CATEGORY_FAST_FOOD),
    ("sandwich", CATEGORY_FAST_FOOD),
    ("coffee", CATEGORY_CAFE),
    ("tea", CATEGORY_CAFE),
    ("bubble_tea", CATEGORY_CAFE),
    ("cake", CATEGORY_DESSERT),
    ("dessert", CATEGORY_DESSERT),
    ("ice_cream", CATEGORY_DESSERT),
    ("bakery", CATEGORY_DESSERT),
)

AMENITY_MAP = {
    "cafe": CATEGORY_CAFE,
    "fast_food": CATEGORY_FAST_FOOD,
    "ice_cream": CATEGORY_DESSERT,
    "restaurant": CATEGORY_OTHER,
    "food_court": CATEGORY_OTHER,
    "bar": CATEGORY_OTHER,
    "pub": CATEGORY_OTHER,
}


@dataclass
class SeedRestaurant:
    """A restaurant ready to be written to the database."""

    name: str
    category: str
    latitude: float
    longitude: float
    external_id: str | None = None
    price_level: int | None = None
    rating: float | None = None
    image_url: str | None = None
    address: str | None = None
    opening_hours: str | None = None
    tags: dict[str, str] = field(default_factory=dict)

    @property
    def google_maps_url(self) -> str:
        """Turn-by-turn navigation link used by the post-match screen."""
        return (
            "https://www.google.com/maps/dir/?api=1"
            f"&destination={self.latitude},{self.longitude}"
        )


# ─── Deterministic filler for fields OSM does not provide ───


def _stable_unit(seed: str, salt: str) -> float:
    """Map a string to a stable float in [0, 1).

    Deterministic so that re-running the seed does not reshuffle prices and
    ratings, which would make manual testing confusing.
    """
    digest = hashlib.sha256(f"{seed}:{salt}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def synthesize_price_level(name: str) -> int:
    """Assign a plausible price tier, skewed cheap for a student neighbourhood."""
    roll = _stable_unit(name, "price")
    if roll < 0.55:
        return 1  # ฿
    if roll < 0.88:
        return 2  # ฿฿
    return 3  # ฿฿฿


def synthesize_rating(name: str) -> float:
    """Assign a plausible rating between 3.4 and 4.9."""
    return round(3.4 + _stable_unit(name, "rating") * 1.5, 1)


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

        results.append(
            SeedRestaurant(
                name=name,
                category=classify(tags),
                latitude=float(latitude),
                longitude=float(longitude),
                external_id=f"osm:{element.get('type')}/{element.get('id')}",
                price_level=parse_osm_price(tags) or synthesize_price_level(name),
                rating=synthesize_rating(name),
                address=build_address(tags),
                opening_hours=tags.get("opening_hours"),
                tags=tags,
            )
        )

    if skipped_unnamed:
        print(f"  skipped {skipped_unnamed} unnamed places")

    return results


def classify(tags: dict[str, str]) -> str:
    """Pick a display category from OSM tags.

    Prefers the ``cuisine`` tag, falls back to ``amenity``.
    """
    cuisine = (tags.get("cuisine") or "").lower()
    for fragment, category in CUISINE_MAP:
        if fragment in cuisine:
            return category

    return AMENITY_MAP.get(tags.get("amenity", ""), CATEGORY_OTHER)


def parse_osm_price(tags: dict[str, str]) -> int | None:
    """Read a price tier from OSM if one happens to be tagged.

    Almost always absent, which is exactly why the app needs synthetic prices.
    """
    raw = (tags.get("price_range") or tags.get("price") or "").strip()
    if not raw:
        return None

    # Some mappers use "$", "$$", "฿฿" style values.
    for symbol in ("฿", "$", "€"):
        if raw.startswith(symbol):
            return min(raw.count(symbol), 3)

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
    "address",
    "image_url",
    "opening_hours",
)


def load_from_csv(path: Path) -> list[SeedRestaurant]:
    """Read curated restaurants from a CSV file.

    Required columns: ``name``, ``latitude``, ``longitude``.
    Everything else is optional and filled in when blank.
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

            results.append(
                SeedRestaurant(
                    name=name,
                    category=(row.get("category") or "").strip() or CATEGORY_OTHER,
                    latitude=latitude,
                    longitude=longitude,
                    external_id=f"manual:{name}",
                    price_level=_optional_int(row.get("price_level"))
                    or synthesize_price_level(name),
                    rating=_optional_float(row.get("rating")) or synthesize_rating(name),
                    address=(row.get("address") or "").strip() or None,
                    image_url=(row.get("image_url") or "").strip() or None,
                    opening_hours=(row.get("opening_hours") or "").strip() or None,
                )
            )

    return results


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
                "address": "",
                "image_url": "",
                "opening_hours": "Mo-Sa 08:00-20:00",
            }
        )


# ─── Synthetic generator (offline fallback) ───

SYNTHETIC_NAMES = (
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

        # sqrt keeps the points uniform by area rather than clustered at the centre.
        distance_km = radius_km * math.sqrt(rng.random())
        bearing = rng.uniform(0, 2 * math.pi)

        delta_lat = (distance_km / 111.0) * math.cos(bearing)
        delta_lng = (distance_km / (111.0 * math.cos(math.radians(latitude)))) * math.sin(
            bearing
        )

        results.append(
            SeedRestaurant(
                name=name,
                category=category,
                latitude=round(latitude + delta_lat, 6),
                longitude=round(longitude + delta_lng, 6),
                external_id=f"synthetic:{index}",
                price_level=synthesize_price_level(name),
                rating=synthesize_rating(name),
                opening_hours="Mo-Su 09:00-21:00",
            )
        )

    return results


# ─── Persistence ───


def deduplicate(rows: list[SeedRestaurant]) -> list[SeedRestaurant]:
    """Drop repeats.

    Overpass can return the same venue as both a node and a building way, and a
    CSV may be re-imported. Keys on external_id first, then name+rounded coords.
    """
    seen: set[str] = set()
    unique: list[SeedRestaurant] = []

    for row in rows:
        key = row.external_id or f"{row.name}@{row.latitude:.5f},{row.longitude:.5f}"
        if key in seen:
            continue
        seen.add(key)
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
        if calculate_distance_km(latitude, longitude, row.latitude, row.longitude)
        <= radius_km
    ]

    dropped = len(rows) - len(inside)
    if dropped:
        print(f"  removed {dropped} row(s) outside {radius_km} km")

    return inside


async def persist(
    rows: list[SeedRestaurant],
    latitude: float,
    longitude: float,
    radius_km: float,
    clear_existing: bool,
) -> tuple[int, int]:
    """Upsert rows by external_id. Returns ``(inserted, updated)``."""
    # Informational only: the dummy provider queries by distance, not cache key.
    cache_key = generate_cache_key(latitude, longitude, radius_km, None)

    inserted = 0
    updated = 0

    async with async_session_factory() as session:
        if clear_existing:
            result = await session.execute(delete(Restaurant))
            print(f"  cleared {result.rowcount or 0} existing restaurant(s)")

        for row in rows:
            existing = None
            if row.external_id and not clear_existing:
                existing = (
                    await session.execute(
                        select(Restaurant).where(Restaurant.external_id == row.external_id)
                    )
                ).scalar_one_or_none()

            if existing is None:
                session.add(
                    Restaurant(
                        external_id=row.external_id,
                        name=row.name,
                        category=row.category,
                        image_url=row.image_url,
                        latitude=row.latitude,
                        longitude=row.longitude,
                        price_level=row.price_level,
                        rating=row.rating,
                        opening_hours=row.opening_hours,
                        address=row.address,
                        google_maps_url=row.google_maps_url,
                        cache_key=cache_key,
                    )
                )
                inserted += 1
            else:
                existing.name = row.name
                existing.category = row.category
                existing.latitude = row.latitude
                existing.longitude = row.longitude
                existing.price_level = row.price_level
                existing.rating = row.rating
                existing.opening_hours = row.opening_hours
                existing.address = row.address
                existing.google_maps_url = row.google_maps_url
                existing.cache_key = cache_key
                # Never overwrite a curated photo with nothing.
                if row.image_url:
                    existing.image_url = row.image_url
                updated += 1

        await session.commit()

    return inserted, updated


def summarize(rows: list[SeedRestaurant]) -> None:
    """Print a category and price breakdown."""
    if not rows:
        return

    by_category: dict[str, int] = {}
    by_price: dict[int | None, int] = {}

    for row in rows:
        by_category[row.category] = by_category.get(row.category, 0) + 1
        by_price[row.price_level] = by_price.get(row.price_level, 0) + 1

    print("\n  By category:")
    for category, count in sorted(by_category.items(), key=lambda kv: -kv[1]):
        print(f"    {category:<12} {count}")

    print("\n  By price:")
    for level in (1, 2, 3, None):
        if level in by_price:
            label = "฿" * level if level else "unknown"
            print(f"    {label:<12} {by_price[level]}")


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
    parser.add_argument(
        "--lat", type=float, default=DEFAULT_LATITUDE, help="Centre latitude"
    )
    parser.add_argument(
        "--lng", type=float, default=DEFAULT_LONGITUDE, help="Centre longitude"
    )
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
            price = "฿" * (row.price_level or 0) or "?"
            print(
                f"    {row.name[:34]:<34} {row.category:<11} "
                f"{price:<4} {row.rating}  ({row.latitude:.5f}, {row.longitude:.5f})"
            )
        print("\nDry run — nothing written.")
        return 0

    inserted, updated = await persist(
        rows, args.lat, args.lng, args.radius, args.clear
    )
    print(f"\nDone. Inserted {inserted}, updated {updated}.")

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
