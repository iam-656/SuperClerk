# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Async Database Engine
# SQLAlchemy 2.0 async engine using asyncpg driver.
#
# Connection strategy:
#   Runtime  → Supabase SESSION pooler (port 5432) — supports
#              asyncpg prepared statements / extended query protocol.
#   Alembic  → Supabase TRANSACTION pooler (port 6543) via psycopg2
#              (configured in alembic/env.py via ALEMBIC_DATABASE_URL).
# ─────────────────────────────────────────────────────────────

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── SQLAlchemy Engine ──────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"statement_cache_size": 0},  # Safety: disable PS cache
)

# ─── Session Factory ────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ─── Declarative Base ───────────────────────────────────────
class Base(DeclarativeBase):
    """Shared SQLAlchemy declarative base for all ORM models."""
    pass


# ─── FastAPI Dependency ─────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an async database session for a single request.
    Automatically commits on success and rolls back on error.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ─── Health Check Helper ─────────────────────────────────────
async def check_db_connection() -> bool:
    """Ping the database — used by the health endpoint."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return False
