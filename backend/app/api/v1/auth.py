# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Auth Router
# POST /api/v1/auth/sync  — upsert user + issue JWT
# GET  /api/v1/auth/me    — validate JWT + return user
# ─────────────────────────────────────────────────────────────

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel, EmailStr

from app.api.deps import AgentAuth, DBSession
from app.repositories.connected_account_repo import ConnectedAccountRepository
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserRead
from app.services.auth_service import (
    create_access_token,
    sync_google_user,
    verify_access_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])
bearer_scheme = HTTPBearer()


# ─── Request / Response Schemas ──────────────────────────────

class SyncRequest(BaseModel):
    """Payload sent by Next.js after Google OAuth success."""
    google_id: str
    email: EmailStr
    name: str
    avatar_url: str | None = None
    # Google OAuth tokens — stored for Gmail API (Phase 5)
    access_token: str | None = None
    refresh_token: str | None = None
    scopes: list[str] | None = None
    token_expires_at: datetime | None = None


class SyncResponse(BaseModel):
    """Returned to the frontend on successful sync."""
    user: UserRead
    access_token: str
    is_new_user: bool


class MeResponse(BaseModel):
    """Current authenticated user."""
    user: UserRead


# ─── POST /auth/sync ─────────────────────────────────────────

@router.post(
    "/sync",
    response_model=SyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync Google OAuth user to DB and issue JWT",
)
async def sync_user(
    body: SyncRequest,
    db: DBSession,
    _: AgentAuth,  # requires valid X-Agent-Secret header
) -> SyncResponse:
    """
    Called by the Next.js frontend immediately after Google OAuth.
    1. Upserts the user in the `users` table
    2. Stores Google OAuth tokens in `connected_accounts`
    3. Returns a signed JWT + the UserRead + is_new_user flag
    """
    user, is_new = await sync_google_user(
        session=db,
        google_id=body.google_id,
        email=str(body.email),
        name=body.name,
        avatar_url=body.avatar_url,
    )

    # Store Google OAuth tokens if provided (used by Gmail in Phase 5)
    if body.access_token:
        ca_repo = ConnectedAccountRepository(db)
        await ca_repo.upsert_google_tokens(
            user_id=user.id,
            provider_account_id=body.google_id,
            access_token=body.access_token,
            refresh_token=body.refresh_token,
            scopes=body.scopes,
            expires_at=body.token_expires_at,
        )
        await db.commit()

    token = create_access_token(user_id=user.id, email=user.email)

    logger.info("Auth sync: user=%s new=%s", user.email, is_new)
    return SyncResponse(user=user, access_token=token, is_new_user=is_new)


# ─── GET /auth/me ────────────────────────────────────────────

@router.get(
    "/me",
    response_model=MeResponse,
    summary="Return authenticated user from JWT",
)
async def get_me(
    db: DBSession,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> MeResponse:
    """
    Validates the Bearer JWT and returns the current user.
    Used by the frontend to verify session validity.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = verify_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, ValueError):
        raise credentials_exception

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user or not user.is_active:
        raise credentials_exception

    return MeResponse(user=UserRead.model_validate(user))
