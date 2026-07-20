# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Analysis Router
# POST /api/v1/analysis/analyze-inbox         — bulk AI analysis
# POST /api/v1/analysis/analyze-email/{id}    — single email AI analysis
# GET  /api/v1/analysis/suggestions           — saved suggestions
# POST /api/v1/analysis/reply/{id}            — send reply via Gmail
# PATCH /api/v1/analysis/status/{id}          — persist approve/reject
# ─────────────────────────────────────────────────────────────

import logging
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel

from app.api.deps import DBSession
from app.services.auth_service import verify_access_token
from app.services.ai_service import (
    analyze_unread_emails,
    analyze_single_email,
    get_saved_suggestions,
    QuotaExhaustedError,
)
from app.services.gmail_service import send_reply
from app.repositories.email_summary_repo import EmailSummaryRepository
from app.repositories.email_repo import EmailRepository

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


class ApprovalStatusRequest(BaseModel):
    approval_status: Literal["approved", "rejected", "pending"]


# ─── POST /analysis/analyze-inbox ────────────────────────────

@router.post(
    "/analyze-inbox",
    summary="Run AI analysis on all unread unprocessed emails",
    status_code=status.HTTP_200_OK,
)
async def analyze_inbox(
    db: DBSession,
    user_id: CurrentUser,
) -> dict:
    logger.info("Analyze inbox triggered by user_id=%s", user_id)
    try:
        results = await analyze_unread_emails(db, user_id)
    except QuotaExhaustedError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )
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


# ─── POST /analysis/analyze-email/{email_id} ─────────────────

@router.post(
    "/analyze-email/{email_id}",
    summary="Run AI analysis on a single email",
    status_code=status.HTTP_200_OK,
)
async def analyze_one_email(
    db: DBSession,
    user_id: CurrentUser,
    email_id: uuid.UUID = Path(..., description="Email UUID to analyse"),
) -> dict:
    """Analyses a specific email and saves the result. Re-analyses even if previously done."""
    logger.info("Single email analysis: user_id=%s email_id=%s", user_id, email_id)
    try:
        result = await analyze_single_email(db, user_id, email_id)
    except QuotaExhaustedError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Single email analysis failed: user_id=%s email_id=%s: %s",
            user_id, email_id, exc, exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI analysis failed. Please try again.",
        )

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")

    return {"status": "ok", "result": result}


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
    try:
        results = await get_saved_suggestions(db, user_id)
    except Exception as exc:
        logger.error("Failed to load suggestions for user_id=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load suggestions.",
        )
    return {"status": "ok", "results": results}


# ─── PATCH /analysis/status/{email_id} ───────────────────────

@router.patch(
    "/status/{email_id}",
    summary="Persist approve/reject decision for an AI suggestion",
    status_code=status.HTTP_200_OK,
)
async def update_approval_status(
    db: DBSession,
    user_id: CurrentUser,
    body: ApprovalStatusRequest,
    email_id: uuid.UUID = Path(..., description="Email UUID"),
) -> dict:
    """Saves the user's approve/reject decision to the database."""
    # Verify email belongs to user
    email_repo = EmailRepository(db)
    email = await email_repo.get(email_id)
    if not email or email.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")

    summary_repo = EmailSummaryRepository(db)
    updated = await summary_repo.update_approval_status(email_id, body.approval_status)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AI summary found for this email.",
        )
    await db.commit()
    logger.info(
        "Approval status updated: user_id=%s email_id=%s status=%s",
        user_id, email_id, body.approval_status,
    )
    return {"status": "ok", "email_id": str(email_id), "approval_status": body.approval_status}


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
    logger.info("Reply requested by user_id=%s for email_id=%s", user_id, email_id)
    result = await send_reply(db, user_id, email_id, body.reply_body)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["error"],
        )
    # Auto-mark as approved after sending
    try:
        summary_repo = EmailSummaryRepository(db)
        await summary_repo.update_approval_status(email_id, "approved")
        await db.commit()
    except Exception:
        pass  # Non-fatal — reply was sent successfully
    return {"status": "sent", **result}
