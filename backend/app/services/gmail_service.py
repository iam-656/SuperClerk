# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Gmail Service
# Wraps the Gmail REST API. Handles:
#   - OAuth credential reconstruction + automatic token refresh
#   - Initial sync: last N days of emails on first connect
#   - Incremental sync: only new messages since last_history_id
#   - Gmail Watch: subscribes inbox to Pub/Sub topic
# ─────────────────────────────────────────────────────────────

import asyncio
import base64
import email as email_lib
import logging
import uuid
from datetime import datetime, timedelta, timezone

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories.connected_account_repo import ConnectedAccountRepository
from app.repositories.email_repo import EmailRepository

logger = logging.getLogger(__name__)
settings = get_settings()

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]


# ─── Credential Builder ──────────────────────────────────────

async def get_gmail_credentials(
    session: AsyncSession, user_id: uuid.UUID
) -> Credentials | None:
    """
    Reconstruct Google OAuth2 Credentials from the DB.
    Automatically refreshes the access_token if expired and saves it back.
    Returns None if no Google account is connected.
    """
    ca_repo = ConnectedAccountRepository(session)
    account = await ca_repo.get_by_user_and_provider(user_id, "google")

    if not account or not account.access_token:
        logger.warning("No Google account found for user_id=%s", user_id)
        return None

    creds = Credentials(
        token=account.access_token,
        refresh_token=account.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=account.scopes or GMAIL_SCOPES,
    )

    # Auto-refresh if expired
    if creds.expired and creds.refresh_token:
        try:
            await asyncio.to_thread(creds.refresh, Request())
            # Save refreshed token back to DB
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


# ─── Message Parsing ─────────────────────────────────────────

def _parse_message(msg: dict) -> dict | None:
    """Parse a Gmail API message dict into our Email schema shape."""
    try:
        headers = {h["name"].lower(): h["value"] for h in msg["payload"]["headers"]}
        gmail_id = msg["id"]
        thread_id = msg.get("threadId")
        subject = headers.get("subject", "(no subject)")
        sender_raw = headers.get("from", "")
        recipient = headers.get("to")
        snippet = msg.get("snippet", "")
        labels = msg.get("labelIds", [])

        # Parse sender name vs email
        sender_name = None
        sender_email = sender_raw
        if "<" in sender_raw:
            parts = sender_raw.split("<")
            sender_name = parts[0].strip().strip('"')
            sender_email = parts[1].rstrip(">").strip()

        # Parse received_at from internalDate (milliseconds since epoch)
        internal_date_ms = int(msg.get("internalDate", 0))
        received_at = datetime.fromtimestamp(internal_date_ms / 1000, tz=timezone.utc)

        # Extract body (prefer plain text, fall back to HTML)
        body_text = None
        body_html = None
        payload = msg.get("payload", {})

        def _extract_body(part: dict) -> None:
            nonlocal body_text, body_html
            mime = part.get("mimeType", "")
            data = part.get("body", {}).get("data", "")
            if data:
                decoded = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
                if mime == "text/plain" and not body_text:
                    body_text = decoded
                elif mime == "text/html" and not body_html:
                    body_html = decoded
            for sub in part.get("parts", []):
                _extract_body(sub)

        _extract_body(payload)

        return {
            "gmail_id": gmail_id,
            "thread_id": thread_id,
            "sender": sender_email,
            "sender_name": sender_name,
            "recipient": recipient,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "snippet": snippet[:500] if snippet else None,
            "labels": labels,
            "is_read": "UNREAD" not in labels,
            "received_at": received_at,
        }
    except Exception as exc:
        logger.warning("Failed to parse Gmail message %s: %s", msg.get("id"), exc)
        return None


# ─── Initial Sync ────────────────────────────────────────────

async def initial_sync(session: AsyncSession, user_id: uuid.UUID) -> dict:
    """
    Fetch the last N days of emails and store them.
    Also starts the Gmail Watch subscription and saves the historyId.
    Called once when a user first connects Gmail.
    """
    creds = await get_gmail_credentials(session, user_id)
    if not creds:
        return {"error": "No Google credentials", "inserted": 0}

    gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)
    days = settings.gmail_initial_sync_days
    after_ts = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    query = f"after:{after_ts}"

    logger.info("Initial sync: user=%s query='%s'", user_id, query)

    # List messages (blocking I/O → run in thread)
    response = await asyncio.to_thread(
        lambda: gmail.users().messages().list(
            userId="me", q=query, maxResults=100
        ).execute()
    )

    message_refs = response.get("messages", [])
    emails_data = []

    for ref in message_refs:
        try:
            msg = await asyncio.to_thread(
                lambda r=ref: gmail.users().messages().get(
                    userId="me", id=r["id"], format="full"
                ).execute()
            )
            parsed = _parse_message(msg)
            if parsed:
                emails_data.append(parsed)
        except Exception as exc:
            logger.warning("Failed to fetch message %s: %s", ref["id"], exc)

    # Bulk upsert into DB
    email_repo = EmailRepository(session)
    inserted, skipped = await email_repo.bulk_upsert_emails(user_id, emails_data)
    await session.commit()

    # Save historyId for incremental sync
    profile = await asyncio.to_thread(
        lambda: gmail.users().getProfile(userId="me").execute()
    )
    history_id = str(profile.get("historyId", ""))
    if history_id:
        ca_repo = ConnectedAccountRepository(session)
        account = await ca_repo.get_by_user_and_provider(user_id, "google")
        if account:
            await ca_repo.update_history_id(account.id, history_id)
            await session.commit()

    # Start Gmail Watch (Pub/Sub subscription)
    if settings.google_pubsub_topic:
        await start_gmail_watch(gmail, user_id)

    logger.info(
        "Initial sync done: user=%s inserted=%d skipped=%d historyId=%s",
        user_id, inserted, skipped, history_id,
    )
    return {"inserted": inserted, "skipped": skipped, "history_id": history_id}


# ─── Incremental Sync ────────────────────────────────────────

async def incremental_sync(session: AsyncSession, user_id: uuid.UUID) -> dict:
    """
    Fetch only emails that arrived since the last saved historyId.
    If no historyId exists yet, falls back to initial_sync.
    """
    creds = await get_gmail_credentials(session, user_id)
    if not creds:
        return {"error": "No Google credentials", "inserted": 0}

    ca_repo = ConnectedAccountRepository(session)
    account = await ca_repo.get_by_user_and_provider(user_id, "google")

    if not account or not account.last_history_id:
        logger.info("No historyId found for user=%s — running initial sync", user_id)
        return await initial_sync(session, user_id)

    gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)

    logger.info(
        "Incremental sync: user=%s since historyId=%s",
        user_id, account.last_history_id,
    )

    try:
        history_resp = await asyncio.to_thread(
            lambda: gmail.users().history().list(
                userId="me",
                startHistoryId=account.last_history_id,
                historyTypes=["messageAdded"],
            ).execute()
        )
    except Exception as exc:
        # historyId expired (> 7 days old) — fall back to initial sync
        logger.warning("historyId expired for user=%s: %s — falling back to initial sync", user_id, exc)
        account.last_history_id = None
        await session.commit()
        return await initial_sync(session, user_id)

    history = history_resp.get("history", [])
    new_history_id = str(history_resp.get("historyId", account.last_history_id))

    message_ids: set[str] = set()
    for record in history:
        for msg_added in record.get("messagesAdded", []):
            message_ids.add(msg_added["message"]["id"])

    emails_data = []
    for msg_id in message_ids:
        try:
            msg = await asyncio.to_thread(
                lambda m=msg_id: gmail.users().messages().get(
                    userId="me", id=m, format="full"
                ).execute()
            )
            parsed = _parse_message(msg)
            if parsed:
                emails_data.append(parsed)
        except Exception as exc:
            logger.warning("Failed to fetch message %s: %s", msg_id, exc)

    email_repo = EmailRepository(session)
    inserted, skipped = await email_repo.bulk_upsert_emails(user_id, emails_data)
    await session.commit()

    # Update historyId cursor
    await ca_repo.update_history_id(account.id, new_history_id)
    await session.commit()

    logger.info(
        "Incremental sync done: user=%s new_messages=%d inserted=%d skipped=%d",
        user_id, len(message_ids), inserted, skipped,
    )
    return {
        "inserted": inserted,
        "skipped": skipped,
        "new_messages_found": len(message_ids),
        "history_id": new_history_id,
    }


# ─── Gmail Watch (Pub/Sub) ───────────────────────────────────

async def start_gmail_watch(gmail, user_id: uuid.UUID) -> None:
    """
    Tell Gmail to push inbox change events to our Pub/Sub topic.
    Must be renewed every 7 days.
    """
    if not settings.google_pubsub_topic:
        logger.warning("GOOGLE_PUBSUB_TOPIC not set — skipping Gmail watch")
        return
    try:
        watch_resp = await asyncio.to_thread(
            lambda: gmail.users().watch(
                userId="me",
                body={
                    "topicName": settings.google_pubsub_topic,
                    "labelIds": ["INBOX"],
                },
            ).execute()
        )
        logger.info(
            "Gmail watch started: user=%s expiration=%s historyId=%s",
            user_id,
            watch_resp.get("expiration"),
            watch_resp.get("historyId"),
        )
    except Exception as exc:
        logger.error("Failed to start Gmail watch for user=%s: %s", user_id, exc)
