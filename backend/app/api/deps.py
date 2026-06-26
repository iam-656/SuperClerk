# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — FastAPI Dependencies
# Shared dependencies injected into route handlers.
# ─────────────────────────────────────────────────────────────

import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── DB Session Dependency ───────────────────────────────────
DBSession = Annotated[AsyncSession, Depends(get_db)]


# ─── Internal Auth Dependency ────────────────────────────────
async def verify_agent_secret(
    x_agent_secret: Annotated[str | None, Header()] = None,
) -> None:
    """
    Validates the X-Agent-Secret header for internal Next.js → FastAPI calls.
    Raises 401 if missing or incorrect.
    """
    if x_agent_secret != settings.ai_agent_secret:
        logger.warning("Unauthorized request — invalid or missing X-Agent-Secret header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing agent secret",
        )


AgentAuth = Annotated[None, Depends(verify_agent_secret)]
