# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Pre-Meeting Briefings (Feature 2)
# Generates contextual briefs for upcoming external meetings.
# ─────────────────────────────────────────────────────────────

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories.connected_account_repo import ConnectedAccountRepository
from app.repositories.user_repo import UserRepository
from app.services.calendar_service import patch_event_description, list_upcoming_meetings
from app.services.google_auth_service import get_google_credentials
from app.services.ai_service import _call_openrouter_with_fallback

logger = logging.getLogger(__name__)
settings = get_settings()

async def prepare_upcoming_meetings(session: AsyncSession, user_id: uuid.UUID) -> None:
    """
    Find meetings starting in ~2 hours with external attendees, 
    generate an AI briefing based on recent emails, and append it to the event.
    """
    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)
    if not user:
        return

    user_domain = user.email.split("@")[-1] if "@" in user.email else ""

    now = datetime.now(timezone.utc)
    # Look for meetings starting between 1.5 and 2.5 hours from now
    time_min = now + timedelta(hours=1, minutes=30)
    time_max = now + timedelta(hours=2, minutes=30)

    meetings = await list_upcoming_meetings(session, user_id, time_min, time_max)

    for meeting in meetings:
        # Check if we already added a briefing (to avoid duplicate work)
        description = meeting.get("description", "")
        if "🤖 **SuperClerk Pre-Meeting Briefing**" in description:
            continue

        attendees = meeting.get("attendees", [])
        external_emails = []
        for attendee in attendees:
            email = attendee.get("email", "")
            # Filter out the user and anyone in the same domain
            if email and "@" in email and email.split("@")[-1] != user_domain and email != user.email:
                external_emails.append(email)

        if not external_emails:
            continue  # Internal meeting, skip

        logger.info("Found external meeting '%s' for user=%s with %s", meeting.get("summary"), user_id, external_emails)

        # Generate Briefing
        briefing = await _generate_briefing(session, user_id, external_emails)
        if not briefing:
            continue

        # Append to description
        new_description = f"🤖 **SuperClerk Pre-Meeting Briefing**\n\n{briefing}\n\n---\n\n{description}"
        await patch_event_description(session, user_id, meeting["id"], new_description)

async def _generate_briefing(session: AsyncSession, user_id: uuid.UUID, external_emails: list[str]) -> str | None:
    """
    Fetch the last 5 email threads with these attendees and pass them to Gemini.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return None

    gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)
    
    # Construct Gmail query (e.g., from:a@b.com OR to:a@b.com)
    query_parts = []
    for email in external_emails:
        query_parts.append(f"from:{email} OR to:{email}")
    query = " OR ".join(query_parts)

    try:
        response = await asyncio.to_thread(
            lambda: gmail.users().messages().list(
                userId="me", q=query, maxResults=5
            ).execute()
        )
        message_refs = response.get("messages", [])
        if not message_refs:
            return "No recent email history found with these attendees."

        # Fetch message snippets
        email_context = []
        for ref in message_refs:
            msg = await asyncio.to_thread(
                lambda: gmail.users().messages().get(
                    userId="me", id=ref["id"], format="metadata", metadataHeaders=["Subject", "Date"]
                ).execute()
            )
            snippet = msg.get("snippet", "")
            headers = msg.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "(no subject)")
            email_context.append(f"Subject: {subject}\nSnippet: {snippet}")

        context_str = "\n\n".join(email_context)
        
        prompt = (
            "You are an executive assistant preparing a briefing for an upcoming meeting.\n"
            "Below are snippets from the 5 most recent emails with the external attendees.\n"
            "Write a very concise bulleted 'Pre-Meeting Briefing' containing:\n"
            "- Context (what was discussed recently)\n"
            "- Pending issues or open questions\n"
            "Keep it under 100 words. Do not use JSON, just output plain text.\n\n"
            f"Recent Emails:\n{context_str}"
        )

        briefing = await _call_openrouter_with_fallback(prompt)
        return briefing.strip()

    except Exception as exc:
        logger.error("Failed to generate briefing for user_id=%s: %s", user_id, exc)
        return None
