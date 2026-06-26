# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Health Service
# Checks DB connectivity and returns structured health status.
# ─────────────────────────────────────────────────────────────

import logging
from datetime import datetime, timezone

from app.database import check_db_connection
from app.schemas.common import HealthStatus

logger = logging.getLogger(__name__)


async def get_health_status() -> HealthStatus:
    """
    Check all infrastructure dependencies and return a structured
    health status object. Used by GET /api/v1/health.
    """
    db_ok = await check_db_connection()

    if not db_ok:
        logger.warning("Health check: database connection failed")

    return HealthStatus(
        status="ok" if db_ok else "degraded",
        db="connected" if db_ok else "disconnected",
        timestamp=datetime.now(timezone.utc),
    )
