"""Application configuration using pydantic-settings."""

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

    # ─── CORS ───
    CORS_ORIGINS: list[str] = ["http://localhost:8081"]

    # ─── Session Defaults ───
    MAX_DECK_SIZE: int = 50

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


settings = Settings()
