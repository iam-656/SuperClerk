# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Emails Router
# GET  /api/v1/emails          — paginated inbox list
# POST /api/v1/emails/sync     — manual sync trigger
# POST /api/v1/emails/initial  — first-time sync (new users)
# ─────────────────────────────────────────────────────────────

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.api.deps import AgentAuth, DBSession
from app.repositories.email_repo import EmailRepository
from app.schemas.email import EmailRead
from app.schemas.common import PaginatedResponse
from app.services.auth_service import verify_access_token
from app.services.gmail_service import incremental_sync, initial_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/emails", tags=["Emails"])
bearer_scheme = HTTPBearer()

# ─── Auth helper ─────────────────────────────────────────────

async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> uuid.UUID:
    """Extract and validate user_id from the Bearer JWT."""
    try:
        payload = verify_access_token(credentials.credentials)
        return uuid.UUID(payload["sub"])
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

CurrentUser = Annotated[uuid.UUID, Depends(get_current_user_id)]


# ─── GET /emails ─────────────────────────────────────────────

@router.get(
    "",
    response_model=PaginatedResponse[EmailRead],
    summary="List emails for the authenticated user",
)
async def list_emails(
    db: DBSession,
    user_id: CurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    unread_only: bool = Query(default=False),
) -> PaginatedResponse[EmailRead]:
    """
    Returns a paginated list of emails for the authenticated user.
    Sorted by received_at descending (newest first).
    """
    repo = EmailRepository(db)
    offset = (page - 1) * page_size
    emails = await repo.get_by_user(
        user_id,
        unread_only=unread_only,
        offset=offset,
        limit=page_size,
    )
    total = await repo.count()

    return PaginatedResponse(
        items=[EmailRead.model_validate(e) for e in emails],
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


# ─── POST /emails/sync ───────────────────────────────────────

@router.post(
    "/sync",
    summary="Manually trigger incremental Gmail sync",
    status_code=status.HTTP_200_OK,
)
async def sync_emails(
    db: DBSession,
    user_id: CurrentUser,
) -> dict:
    """
    Triggers an incremental Gmail sync for the authenticated user.
    If no historyId exists yet, runs an initial 3-day sync instead.
    This is the endpoint called by the frontend 'Refresh' button.
    """
    logger.info("Manual sync triggered by user_id=%s", user_id)
    result = await incremental_sync(db, user_id)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result["error"],
        )
    return {"status": "ok", **result}


# ─── POST /emails/initial ────────────────────────────────────

@router.post(
    "/initial",
    summary="Run initial Gmail sync (first-time setup)",
    status_code=status.HTTP_200_OK,
)
async def initial_sync_endpoint(
    db: DBSession,
    user_id: CurrentUser,
) -> dict:
    """
    Runs the full initial sync: fetches the last 3 days of emails,
    saves the historyId, and starts the Gmail Watch subscription.
    Called once after a user first connects their Gmail account.
    """
    logger.info("Initial sync triggered by user_id=%s", user_id)
    result = await initial_sync(db, user_id)
    return {"status": "ok", **result}
