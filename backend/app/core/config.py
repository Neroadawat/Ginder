"""Application configuration using pydantic-settings."""

from typing import Literal
from urllib.parse import urlsplit

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ─── App ───
    APP_NAME: str = "Ginder"
    APP_ENV: Literal["development", "test", "production"] = "development"
    DEBUG: bool = True
    EXPOSE_API_DOCS: bool = True

    # ─── Database ───
    DATABASE_URL: str = "postgresql+asyncpg://ginder:ginder_secret@localhost:5432/ginder"

    # ─── Redis ───
    REDIS_URL: str = "redis://localhost:6379/0"

    # ─── JWT / Auth ───
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ISSUER: str = "ginder-api"
    JWT_AUDIENCE: str = "ginder-app"

    # ─── Email (Password Reset) ───
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@ginder.app"
    SMTP_SECURITY: Literal["starttls", "ssl"] = "starttls"
    SMTP_TIMEOUT_SECONDS: float = 10.0
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    SUPPORT_EMAIL: str = ""
    PASSWORD_RESET_EMAIL_LIMIT: int = 3
    PASSWORD_RESET_IP_LIMIT: int = 10
    PASSWORD_RESET_WINDOW_SECONDS: int = 900

    # ─── Firebase Cloud Messaging ───
    FCM_CREDENTIALS_PATH: str = "./firebase-credentials.json"
    FCM_ENABLED: bool = False

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

    # ─── Google Places live fallback (Solo only) ───
    # Disabled until a restricted server-side key is configured. The key must
    # never be copied into the React Native environment.
    GOOGLE_PLACES_ENABLED: bool = False
    GOOGLE_PLACES_API_KEY: str = ""
    GOOGLE_PLACES_BASE_URL: str = "https://places.googleapis.com/v1"
    GOOGLE_PLACES_TIMEOUT_SECONDS: float = 8.0
    GOOGLE_NEARBY_SOFT_LIMIT: int = 800
    GOOGLE_NEARBY_HARD_LIMIT: int = 1000
    # Metadata-only discovery: photos are disabled even for older clients.
    GOOGLE_PHOTO_SOFT_LIMIT: int = 0
    GOOGLE_PHOTO_HARD_LIMIT: int = 0
    GOOGLE_USER_COOLDOWN_SECONDS: int = 30

    # ─── CORS ───
    CORS_ORIGINS: list[str] = ["http://localhost:8081"]
    ALLOWED_HOSTS: list[str] = ["*"]

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

    # Admin stays closed until explicitly enabled. AWS credentials come from
    # the EC2 instance role / standard SDK chain, never the browser or Git.
    ADMIN_ENABLED: bool = False
    ADMIN_SESSION_HOURS: int = 4
    RESTAURANT_PHOTO_BUCKET: str = ""
    RESTAURANT_PHOTO_REGION: str = "ap-southeast-2"
    RESTAURANT_PHOTO_MAX_BYTES: int = 5 * 1024 * 1024

    @model_validator(mode="after")
    def validate_production_safety(self) -> "Settings":
        """Refuse to boot production with development defaults or open origins."""
        if self.APP_ENV != "production":
            return self

        errors: list[str] = []
        if not 1 <= self.ADMIN_SESSION_HOURS <= 24:
            errors.append("ADMIN_SESSION_HOURS must be between 1 and 24")
        if not 1 <= self.RESTAURANT_PHOTO_MAX_BYTES <= 5 * 1024 * 1024:
            errors.append("RESTAURANT_PHOTO_MAX_BYTES must be between 1 and 5 MiB")
        if self.DEBUG:
            errors.append("DEBUG must be false")
        if self.EXPOSE_API_DOCS:
            errors.append("EXPOSE_API_DOCS must be false")
        if (
            self.SECRET_KEY == "change-me-in-production"
            or "CHANGE_ME" in self.SECRET_KEY
            or len(self.SECRET_KEY) < 32
        ):
            errors.append("SECRET_KEY must be a unique value of at least 32 characters")
        if self.RESTAURANT_DATA_MODE != "production":
            errors.append("RESTAURANT_DATA_MODE must be production")
        if not self.CORS_ORIGINS or "*" in self.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must contain explicit HTTPS origins")
        elif any(not origin.startswith("https://") for origin in self.CORS_ORIGINS):
            errors.append("every production CORS origin must use HTTPS")
        if not self.ALLOWED_HOSTS or "*" in self.ALLOWED_HOSTS:
            errors.append("ALLOWED_HOSTS must contain explicit hostnames")
        if "localhost" in self.DATABASE_URL or "CHANGE_ME" in self.DATABASE_URL:
            errors.append("DATABASE_URL must not use localhost")
        if "localhost" in self.REDIS_URL or "CHANGE_ME" in self.REDIS_URL:
            errors.append("REDIS_URL must not use localhost")
        if self.GOOGLE_PLACES_ENABLED and (
            not self.GOOGLE_PLACES_API_KEY
            or "CHANGE_ME" in self.GOOGLE_PLACES_API_KEY
        ):
            errors.append("GOOGLE_PLACES_API_KEY is required when Google Places is enabled")
        public_url = urlsplit(self.PUBLIC_BASE_URL)
        if public_url.scheme != "https" or not public_url.hostname:
            errors.append("PUBLIC_BASE_URL must be an absolute HTTPS URL")
        if not self.SUPPORT_EMAIL or "@" not in self.SUPPORT_EMAIL:
            errors.append("SUPPORT_EMAIL must be a monitored email address")
        if not self.SMTP_HOST or not self.SMTP_USER or not self.SMTP_PASSWORD:
            errors.append("SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required")
        if "@" not in self.EMAIL_FROM:
            errors.append("EMAIL_FROM must be a valid sender address")
        if self.PASSWORD_RESET_WINDOW_SECONDS < 60:
            errors.append("PASSWORD_RESET_WINDOW_SECONDS must be at least 60")

        if errors:
            raise ValueError("Unsafe production configuration: " + "; ".join(errors))
        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()
