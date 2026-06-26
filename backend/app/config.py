# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Configuration
# Uses Pydantic Settings for type-safe env validation.
# Fails fast on startup if required vars are missing.
# ─────────────────────────────────────────────────────────────

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── App ────────────────────────────────────────────────
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    frontend_url: str = "http://localhost:3000"

    # ─── Database ───────────────────────────────────────────
    database_url: str  # Required — asyncpg URL for runtime
    alembic_database_url: str = ""  # psycopg2 URL for migrations (set in .env)

    # ─── Security ───────────────────────────────────────────
    ai_agent_secret: str  # Required — used for internal Next.js → FastAPI auth

    # ─── Google OAuth ───────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_cloud_project_id: str = ""

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton — safe to call anywhere."""
    return Settings()
