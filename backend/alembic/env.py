# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Alembic Environment
# Uses sync psycopg2 driver for migrations (ALEMBIC_DATABASE_URL).
# Runtime app uses asyncpg (DATABASE_URL) — separate concerns.
# ─────────────────────────────────────────────────────────────

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ─── Import all models so Alembic sees all table metadata ───
from app.database import Base
import app.models  # noqa: F401 — registers all ORM models

from app.config import get_settings

# ─── Alembic Config Object ───────────────────────────────────
config = context.config
settings = get_settings()

# Use the sync psycopg2 URL for Alembic — falls back to asyncpg
# URL with driver swapped if ALEMBIC_DATABASE_URL not explicitly set.
alembic_url = settings.alembic_database_url or settings.database_url.replace(
    "postgresql+asyncpg://", "postgresql+psycopg2://"
)
config.set_main_option("sqlalchemy.url", alembic_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ─── Offline Mode ────────────────────────────────────────────
def run_migrations_offline() -> None:
    """Generate SQL without a live DB connection."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ─── Online Mode ─────────────────────────────────────────────
def run_migrations_online() -> None:
    """Run migrations with a live DB connection (sync)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,   # Detect column type changes
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


# ─── Entry Point ─────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
