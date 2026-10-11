"""Small, provider-neutral helpers for OpenStreetMap eatery records."""

from dataclasses import dataclass
from typing import Any

EATERY_AMENITIES = (
    "restaurant",
    "cafe",
    "fast_food",
    "food_court",
    "ice_cream",
    "bar",
    "pub",
)

CATEGORY_TYPE: dict[str, str] = {
    "Thai": "thai_restaurant",
    "Japanese": "japanese_restaurant",
    "Korean": "korean_restaurant",
    "Chinese": "chinese_restaurant",
    "Italian": "italian_restaurant",
    "Fast Food": "fast_food_restaurant",
    "Cafe": "cafe",
    "Dessert": "dessert_shop",
    "Food Court": "food_court",
    "Steak": "steak_house",
    "Hot Pot": "restaurant",
    "Indian": "indian_restaurant",
    "Other": "restaurant",
}

CUISINE_MAP: tuple[tuple[str, str, str], ...] = (
    ("thai", "Thai", "thai_restaurant"),
    ("isan", "Thai", "thai_restaurant"),
    ("อาหารอีสาน", "Thai", "thai_restaurant"),
    ("noodle", "Thai", "noodle_shop"),
    ("som_tam", "Thai", "thai_restaurant"),
    ("japanese", "Japanese", "japanese_restaurant"),
    ("sushi", "Japanese", "sushi_restaurant"),
    ("ramen", "Japanese", "ramen_restaurant"),
    ("korean", "Korean", "korean_restaurant"),
    ("chinese", "Chinese", "chinese_restaurant"),
    ("dim_sum", "Chinese", "chinese_restaurant"),
    ("italian", "Italian", "italian_restaurant"),
    ("pizza", "Italian", "pizza_restaurant"),
    ("pasta", "Italian", "italian_restaurant"),
    ("burger", "Fast Food", "hamburger_restaurant"),
    ("chicken", "Fast Food", "fast_food_restaurant"),
    ("sandwich", "Fast Food", "sandwich_shop"),
    ("coffee", "Cafe", "coffee_shop"),
    ("tea", "Cafe", "tea_house"),
    ("bubble_tea", "Cafe", "bubble_tea_store"),
    ("cake", "Dessert", "dessert_shop"),
    ("dessert", "Dessert", "dessert_shop"),
    ("ice_cream", "Dessert", "ice_cream_shop"),
    ("bakery", "Dessert", "bakery"),
    ("steak", "Steak", "steak_house"),
    ("hot_pot", "Hot Pot", "restaurant"),
    ("shabu", "Hot Pot", "restaurant"),
    ("indian", "Indian", "indian_restaurant"),
)

AMENITY_MAP: dict[str, tuple[str, str]] = {
    "cafe": ("Cafe", "cafe"),
    "fast_food": ("Fast Food", "fast_food_restaurant"),
    "ice_cream": ("Dessert", "ice_cream_shop"),
    "restaurant": ("Other", "restaurant"),
    "food_court": ("Food Court", "food_court"),
    "bar": ("Other", "bar"),
    "pub": ("Other", "pub"),
}

GENERIC_TYPES = ("restaurant", "food", "point_of_interest", "establishment")


@dataclass(frozen=True)
class OsmRestaurant:
    source_place_id: str
    name: str
    latitude: float
    longitude: float
    primary_category: str
    types: list[str]
    address: str | None


def build_overpass_query(latitude: float, longitude: float, radius_km: float) -> str:
    """Build a bounded query for named eating venues."""
    amenities = "|".join(EATERY_AMENITIES)
    radius_metres = max(1, round(radius_km * 1000))
    around = f"(around:{radius_metres},{latitude:.6f},{longitude:.6f})"
    selector = f'["amenity"~"^({amenities})$"]["name"]'
    return (
        "[out:json][timeout:20];"
        "("
        f"node{around}{selector};"
        f"way{around}{selector};"
        ");out center tags qt;"
    )


def parse_osm_elements(elements: list[dict[str, Any]]) -> list[OsmRestaurant]:
    """Convert Overpass elements to honest restaurant records.

    OSM does not provide Google ratings or photos, so those fields are not
    invented here. Invalid and unnamed records are discarded.
    """
    rows: list[OsmRestaurant] = []
    seen: set[str] = set()
    for element in elements:
        element_type = str(element.get("type", ""))
        element_id = element.get("id")
        source_place_id = f"{element_type}/{element_id}"
        if element_type not in {"node", "way", "relation"} or element_id is None:
            continue
        if source_place_id in seen:
            continue

        tags = element.get("tags") or {}
        name = _first_text(tags.get("name"), tags.get("name:th"), tags.get("name:en"))
        coordinates = _coordinates(element)
        if not name or coordinates is None:
            continue

        category, specific_type = classify_osm(tags)
        rows.append(
            OsmRestaurant(
                source_place_id=source_place_id,
                name=name,
                latitude=coordinates[0],
                longitude=coordinates[1],
                primary_category=category,
                types=build_types(specific_type, category),
                address=format_osm_address(tags),
            )
        )
        seen.add(source_place_id)
    return rows


def classify_osm(tags: dict[str, Any]) -> tuple[str, str]:
    cuisine = str(tags.get("cuisine", "")).lower()
    for fragment, category, specific_type in CUISINE_MAP:
        if fragment in cuisine:
            return category, specific_type
    return AMENITY_MAP.get(str(tags.get("amenity", "")).lower(), ("Other", "restaurant"))


def build_types(specific: str, category: str) -> list[str]:
    ordered: list[str] = []
    for candidate in (specific, CATEGORY_TYPE.get(category, "restaurant"), *GENERIC_TYPES):
        if candidate and candidate not in ordered:
            ordered.append(candidate)
    return ordered


def format_osm_address(tags: dict[str, Any]) -> str | None:
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:subdistrict"),
        tags.get("addr:district"),
        tags.get("addr:city"),
        tags.get("addr:province"),
    ]
    clean = [str(part).strip() for part in parts if str(part or "").strip()]
    return ", ".join(dict.fromkeys(clean)) or None


def _coordinates(element: dict[str, Any]) -> tuple[float, float] | None:
    latitude = element.get("lat")
    longitude = element.get("lon")
    if latitude is None or longitude is None:
        centre = element.get("center") or {}
        latitude = centre.get("lat")
        longitude = centre.get("lon")
    if latitude is None or longitude is None:
        return None
    try:
        return float(latitude), float(longitude)
    except (TypeError, ValueError):
        return None


def _first_text(*values: Any) -> str | None:
    for value in values:
        if value is not None and str(value).strip():
            return str(value).strip()
    return None
