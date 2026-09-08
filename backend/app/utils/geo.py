"""Geolocation utilities — distance calculation, bounding boxes, geohash cache keys."""

import math

# Mean Earth radius in kilometres
EARTH_RADIUS_KM = 6371.0

# Approximate kilometres per degree of latitude (near-constant everywhere)
KM_PER_DEGREE_LAT = 111.0


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using the Haversine formula.

    Returns distance in kilometres.
    """
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_KM * c


def bounding_box(
    latitude: float, longitude: float, radius_km: float
) -> tuple[float, float, float, float]:
    """Compute a lat/lng bounding box that fully contains the given radius.

    Used to pre-filter rows in SQL before applying the exact Haversine check,
    so we never load the whole table into memory.

    Returns ``(min_lat, max_lat, min_lng, max_lng)``.

    The box is intentionally a slight over-approximation of the circle — callers
    must still apply :func:`calculate_distance_km` to reject the corners.
    """
    lat_delta = radius_km / KM_PER_DEGREE_LAT

    # Longitude degrees shrink as you move away from the equator.
    # Guard against division by zero at the poles.
    cos_lat = math.cos(math.radians(latitude))
    if abs(cos_lat) < 1e-9:
        lng_delta = 180.0
    else:
        lng_delta = radius_km / (KM_PER_DEGREE_LAT * abs(cos_lat))

    return (
        latitude - lat_delta,
        latitude + lat_delta,
        longitude - lng_delta,
        longitude + lng_delta,
    )


def generate_cache_key(
    latitude: float,
    longitude: float,
    radius_km: float,
    category: str | None = None,
) -> str:
    """Generate a grid-based cache key for restaurant queries.

    Snaps coordinates to a fixed grid cell and buckets the radius so that
    nearby sessions with similar settings share one cached result set,
    reducing external API calls.

    Format: ``{grid_cell}_{radius_bucket}_{category}`` (requirement 15.3),
    where ``grid_cell`` packs both coordinates into one token so the key has
    exactly three ``_``-separated parts as documented, rather than splitting
    latitude and longitude into separate segments.

    Note: this is only used when fetching from an external provider. Locally
    seeded data is queried by distance instead — see
    ``RestaurantService._fetch_by_distance``.
    """
    # Snap to a ~400 m grid (0.004 degrees latitude)
    grid_precision = 0.004
    grid_lat = round(latitude / grid_precision) * grid_precision
    grid_lng = round(longitude / grid_precision) * grid_precision

    grid_cell = f"{grid_lat:.4f},{grid_lng:.4f}"
    radius_bucket = _bucket_radius(radius_km)
    cat = category or "all"

    return f"{grid_cell}_{radius_bucket}_{cat}"


def _bucket_radius(radius_km: float) -> str:
    """Bucket a radius into a coarse range to improve cache hit rate.

    Buckets are always >= the requested radius, so a bucket's cached set is a
    superset of what the caller needs; the exact distance filter narrows it down.
    Sub-kilometre buckets exist because the app offers 0.5 km increments.
    """
    for threshold, label in (
        (0.5, "0.5km"),
        (1.0, "1km"),
        (1.5, "1.5km"),
        (2.0, "2km"),
        (3.0, "3km"),
        (5.0, "5km"),
        (10.0, "10km"),
        (20.0, "20km"),
    ):
        if radius_km <= threshold:
            return label
    return "50km"
