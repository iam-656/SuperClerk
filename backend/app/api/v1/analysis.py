# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Analysis Router
# POST /api/v1/analysis/analyze-inbox  — run Gemini on unread emails
# GET  /api/v1/analysis/suggestions    — return saved suggestions
# POST /api/v1/analysis/reply/:id      — send a reply via Gmail
# ─────────────────────────────────────────────────────────────

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel

from app.api.deps import DBSession
from app.services.auth_service import verify_access_token
from app.services.ai_service import analyze_unread_emails, get_saved_suggestions
from app.services.gmail_service import send_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Analysis"])
bearer_scheme = HTTPBearer()


# ─── Auth helper ─────────────────────────────────────────────

async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> uuid.UUID:
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


# ─── Request/Response Schemas ─────────────────────────────────

class ReplyRequest(BaseModel):
    reply_body: str


# ─── POST /analysis/analyze-inbox ────────────────────────────

@router.post(
    "/analyze-inbox",
    summary="Run Gemini AI analysis on unread unprocessed emails",
    status_code=status.HTTP_200_OK,
)
async def analyze_inbox(
    db: DBSession,
    user_id: CurrentUser,
) -> dict:
    """
    Sends all unread+unprocessed emails to Gemini 2.0 Flash.
    Returns action suggestions (reply draft or reminder reason) for each.
    Results are saved to email_summaries and emails are marked as processed.
    """
    logger.info("Analyze inbox triggered by user_id=%s", user_id)
    try:
        results = await analyze_unread_emails(db, user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("AI analysis failed for user_id=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI analysis failed. Please try again.",
        )
    return {"status": "ok", "analysed": len(results), "results": results}


# ─── GET /analysis/suggestions ───────────────────────────────

@router.get(
    "/suggestions",
    summary="Return saved AI suggestions for all analysed emails",
    status_code=status.HTTP_200_OK,
)
async def get_suggestions(
    db: DBSession,
    user_id: CurrentUser,
) -> dict:
    """
    Returns previously-saved Gemini suggestions without re-calling the API.
    The frontend loads these on page refresh so suggestions persist.
    """
    try:
        results = await get_saved_suggestions(db, user_id)
    except Exception as exc:
        logger.error("Failed to load suggestions for user_id=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load suggestions.",
        )
    return {"status": "ok", "results": results}


# ─── POST /analysis/reply/{email_id} ─────────────────────────

@router.post(
    "/reply/{email_id}",
    summary="Send a reply to an email via Gmail",
    status_code=status.HTTP_200_OK,
)
async def reply_to_email(
    db: DBSession,
    user_id: CurrentUser,
    email_id: uuid.UUID = Path(..., description="Email UUID from our database"),
    body: ReplyRequest = ...,
) -> dict:
    """
    Sends a reply to the specified email using the user's Gmail credentials.
    The reply preserves the original thread via In-Reply-To / References headers.
    """
    logger.info("Reply requested by user_id=%s for email_id=%s", user_id, email_id)
    result = await send_reply(db, user_id, email_id, body.reply_body)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["error"],
        )
    return {"status": "sent", **result}
