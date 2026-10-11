"""Application configuration using pydantic-settings."""

from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ─── App ───
    APP_NAME: str = "Ginder"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # ─── Database ───
    DATABASE_URL: str = "postgresql+asyncpg://ginder:ginder_secret@localhost:5432/ginder"

    # ─── Redis ───
    REDIS_URL: str = "redis://localhost:6379/0"

    # ─── JWT / Auth ───
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ─── Email (Password Reset) ───
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@ginder.app"

    # ─── Firebase Cloud Messaging ───
    FCM_CREDENTIALS_PATH: str = "./firebase-credentials.json"

    # ─── Restaurant Data API ───
    RESTAURANT_API_PROVIDER: str = "dummy"
    RESTAURANT_API_KEY: str = ""
    RESTAURANT_API_BASE_URL: str = ""

    # Production discovery must use only real/curated rows. Development mode
    # keeps synthetic venues available for offline UI testing.
    RESTAURANT_DATA_MODE: Literal["production", "development"] = "development"

    # If a production search has no local results, fetch real OSM venues once
    # for the shared grid cell. OSM content may be cached, unlike Google Places
    # content, so it also works with persisted likes and party-session decks.
    RESTAURANT_FALLBACK_PROVIDER: Literal["none", "osm"] = "osm"
    RESTAURANT_FALLBACK_CACHE_HOURS: int = 168
    # Total budget for the first uncached search. Mobile discovery requests use
    # a matching, slightly longer timeout; cached searches remain instant.
    RESTAURANT_FALLBACK_TIMEOUT_SECONDS: float = 40.0
    OSM_OVERPASS_PRIMARY_URL: str = "https://overpass.private.coffee/api/interpreter"
    OSM_OVERPASS_SECONDARY_URL: str = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
    OSM_OVERPASS_TERTIARY_URL: str = "https://overpass-api.de/api/interpreter"

    # ─── CORS ───
    CORS_ORIGINS: list[str] = ["http://localhost:8081"]

    # ─── Session Defaults ───
    # Keep the first deck quick to scan. More restaurants are reached by
    # widening the radius instead of returning an unbounded payload.
    MAX_DECK_SIZE: int = 20
    # Below this number the area is usable in solo mode but is reported as
    # partial coverage; party sessions wait for a wider radius/fewer filters.
    MIN_LOCAL_RESTAURANTS: int = 10

    # ─── Search Radius (requirement 6) ───
    # Capped for the Thammasat Rangsit launch: students walk or ride to eat, so
    # a wider radius would fill the deck with places nobody visits.
    MIN_RADIUS_KM: float = 0.5
    MAX_RADIUS_KM: float = 3.0

    # ─── Locale ───
    # Opening hours are local time, so "open now" is evaluated here, not in UTC.
    APP_TIMEZONE: str = "Asia/Bangkok"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()
