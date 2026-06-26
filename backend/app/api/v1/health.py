# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Health Router
# GET /api/v1/health — Infrastructure liveness check
# ─────────────────────────────────────────────────────────────

from fastapi import APIRouter

from app.schemas.common import HealthStatus
from app.services.health_service import get_health_status

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthStatus,
    summary="Infrastructure health check",
    description="Returns DB connectivity status and service version.",
)
async def health_check() -> HealthStatus:
    """
    Ping all infrastructure dependencies and return a structured status.
    - **status**: 'ok' if all systems up, 'degraded' if any issue
    - **db**: 'connected' or 'disconnected'
    """
    return await get_health_status()
