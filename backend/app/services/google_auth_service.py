# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Google Auth Service
# Provides credentials reconstruction for Google Workspace APIs.
# ─────────────────────────────────────────────────────────────

import asyncio
import logging
import uuid
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories.connected_account_repo import ConnectedAccountRepository

logger = logging.getLogger(__name__)
settings = get_settings()

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/calendar.events",
]

async def get_google_credentials(
    session: AsyncSession, user_id: uuid.UUID
) -> Credentials | None:
    """
    Reconstruct Google OAuth2 Credentials from the DB.
    Automatically refreshes the access_token if expired and saves it back.
    Returns None if no Google account is connected or credentials are unusable.
    """
    ca_repo = ConnectedAccountRepository(session)
    account = await ca_repo.get_by_user_and_provider(user_id, "google")

    if not account or not account.access_token:
        logger.warning("No Google account found for user_id=%s", user_id)
        return None

    creds = Credentials(
        token=account.access_token,
        refresh_token=account.refresh_token or None,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=account.scopes or GMAIL_SCOPES,
    )

    if creds.expired and not creds.refresh_token:
        logger.warning(
            "Access token expired and no refresh_token stored for user_id=%s. "
            "User must sign out and sign back in.",
            user_id,
        )
        return None

    if creds.expired and creds.refresh_token:
        try:
            await asyncio.to_thread(creds.refresh, Request())
            await ca_repo.upsert_google_tokens(
                user_id=user_id,
                provider_account_id=account.provider_account_id,
                access_token=creds.token,
                refresh_token=creds.refresh_token,
                scopes=list(creds.scopes) if creds.scopes else None,
                expires_at=creds.expiry,
            )
            await session.commit()
            logger.info("Refreshed Google token for user_id=%s", user_id)
        except Exception as exc:
            logger.error("Token refresh failed for user_id=%s: %s", user_id, exc)
            return None

    return creds
