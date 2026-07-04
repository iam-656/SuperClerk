# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — FastAPI Application
# App factory with lifespan, CORS, middleware, and routers.
# Phase 5: Added scheduler + Pub/Sub pull worker to lifespan.
# ─────────────────────────────────────────────────────────────

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.emails import router as emails_router
from app.config import get_settings
from app.database import check_db_connection
from app.scheduler import start_scheduler, stop_scheduler
from app.workers.pubsub_worker import pubsub_pull_worker

# ─── Logging ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Lifespan ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("SuperClerk backend starting up (env=%s)", settings.app_env)

    # 1. Verify DB on startup
    db_ok = await check_db_connection()
    if db_ok:
        logger.info("✅ Database connected")
    else:
        logger.error("❌ Database connection FAILED — check DATABASE_URL")

    # 2. Start 15-minute fallback scheduler
    start_scheduler()

    # 3. Start Pub/Sub pull worker as background task
    pubsub_task = asyncio.create_task(
        pubsub_pull_worker(), name="pubsub_pull_worker"
    )
    logger.info("✅ Pub/Sub pull worker started")

    yield  # ── App is now running ──

    # Shutdown
    logger.info("SuperClerk backend shutting down")
    stop_scheduler()
    pubsub_task.cancel()
    try:
        await pubsub_task
    except asyncio.CancelledError:
        pass


# ─── App Factory ────────────────────────────────────────────
app = FastAPI(
    title="SuperClerk API",
    description="AI Operating System for Small Businesses — Backend API",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)


# ─── CORS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request Logging Middleware ──────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, status code, and duration."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s → %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ─── Global Exception Handler ───────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch any unhandled exception and return a clean JSON error."""
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ─── Routers ────────────────────────────────────────────────
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(emails_router, prefix="/api/v1")


# ─── Root Redirect ──────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return {"message": "SuperClerk API v1 — see /docs for reference"}
