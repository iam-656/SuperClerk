# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — AI Email Analysis Service
# Uses OpenRouter API (OpenAI-compatible) to analyse unread emails
# and suggest actions (reply or set reminder) with pre-written drafts.
# Primary model: cohere/north-mini-code:free via OpenRouter
# ─────────────────────────────────────────────────────────────

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories.email_repo import EmailRepository
from app.repositories.email_summary_repo import EmailSummaryRepository
from app.repositories.reminder_repo import ReminderRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)
settings = get_settings()

# OpenRouter endpoint (OpenAI-compatible)
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Model to use — free model on OpenRouter (as specified by user)
_OPENROUTER_MODEL = "cohere/north-mini-code:free"

# Fallback models in order if the primary is unavailable
_FALLBACK_MODELS = [
    "cohere/command-r7b-12-2024:free",
    "mistralai/mistral-small-24b-instruct-2501:free",
    "meta-llama/llama-3.1-8b-instruct:free",
]

# Pattern to detect automated/no-reply senders (Fix 1)
_NO_REPLY_PATTERN = re.compile(
    r"(no.?reply|noreply|donotreply|do.not.reply|mailer.daemon|notifications?@|alerts?@|system@|automated@)",
    re.IGNORECASE,
)


class QuotaExhaustedError(RuntimeError):
    """Raised when all models are rate-limited or unavailable."""


# ─── Helper: is this a no-reply / automated sender? ─────────
def _is_no_reply(sender_email: str) -> bool:
    """Fix 1: Return True if the sender is an automated no-reply address."""
    return bool(_NO_REPLY_PATTERN.search(sender_email))


# ─── Helper: is this a SENT / outgoing email? ────────────────
def _is_outgoing(email_labels: list[str] | None, sender_email: str, user_email: str) -> bool:
    """Fix 2: Return True if the email was sent BY the user (outgoing mail)."""
    if email_labels and "SENT" in email_labels:
        return True
    return sender_email.lower() == user_email.lower()


# ─── Main analysis entry point ───────────────────────────────

async def analyze_unread_emails(
    session: AsyncSession, user_id: uuid.UUID
) -> list[dict]:
    """
    Fetch all unread+unprocessed inbound emails for `user_id`, send them to the
    LLM via OpenRouter, persist results to email_summaries, and return
    the analysis.
    """
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured in the backend .env")

    # Fetch user for email + name (Fix 2 + Fix 3)
    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)
    user_email = user.email if user else ""
    user_name = user.name if user else "the user"

    # 1. Fetch emails to analyse
    email_repo = EmailRepository(session)
    emails = await email_repo.get_unread_unprocessed(user_id, limit=20)

    if not emails:
        return []

    # 2. Build structured payload — skipping no-reply and outgoing (Fix 1 + 2)
    email_list = []
    skipped_ids: list[uuid.UUID] = []

    for e in emails:
        if _is_no_reply(e.sender) or _is_outgoing(e.labels, e.sender, user_email):
            logger.info(
                "Skipping email %s from %s (no-reply or outgoing)", e.id, e.sender
            )
            skipped_ids.append(e.id)
            continue

        email_list.append({
            "email_id": str(e.id),
            "subject": e.subject,
            "sender": e.sender_name or e.sender,
            "sender_email": e.sender,
            "body": (e.body_text or e.snippet or "")[:2000],
        })

    # Mark skipped emails as processed so they are not repeatedly re-checked
    for eid in skipped_ids:
        await email_repo.mark_as_processed(eid)

    if not email_list:
        await session.commit()
        return []

    prompt = _build_prompt(email_list, user_name)

    # 3. Call LLM via OpenRouter with fallback
    raw = await _call_openrouter_with_fallback(prompt)

    # 4. Parse JSON response
    try:
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])  # drop opening ```json line
            text = text.rsplit("```", 1)[0].strip()  # drop closing ```
        results: list[dict] = json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM JSON response: %s\nRaw: %s", exc, raw[:500])
        raise ValueError(f"LLM returned invalid JSON: {exc}") from exc

    # 5. Persist to email_summaries, auto-create reminders, and mark emails processed
    summary_repo = EmailSummaryRepository(session)
    reminder_repo = ReminderRepository(session)
    email_obj_map = {str(e.id): e for e in emails}
    valid_email_ids = {str(e.id) for e in emails}

    for result in results:
        eid_str = result.get("email_id", "")
        if eid_str not in valid_email_ids:
            logger.warning("LLM returned unknown email_id %s — skipping", eid_str)
            continue
        try:
            email_id = uuid.UUID(eid_str)
            action = result.get("action", "reminder")
            await summary_repo.upsert(
                email_id=email_id,
                summary=result.get("summary", ""),
                action=action,
                reply_draft=result.get("reply_draft"),
                reminder_reason=result.get("reminder_reason"),
                priority=int(result.get("priority", 3)),
            )
            await email_repo.mark_as_processed(email_id)

            # Fix 5: Auto-create Reminder record if action is "reminder"
            if action == "reminder":
                email_obj = email_obj_map.get(eid_str)
                await _auto_create_reminder(
                    reminder_repo=reminder_repo,
                    user_id=user_id,
                    email_id=email_id,
                    subject=email_obj.subject if email_obj else "(no subject)",
                    note=result.get("reminder_reason"),
                )

        except Exception as exc:
            logger.warning(
                "Failed to persist summary for email_id=%s: %s", eid_str, exc
            )

    await session.commit()
    logger.info(
        "AI analysis complete: user=%s emails_analysed=%d", user_id, len(results)
    )
    return results


async def get_saved_suggestions(
    session: AsyncSession, user_id: uuid.UUID
) -> list[dict]:
    """
    Return previously-saved AI suggestions for all emails belonging to user_id.
    Used so the frontend can reload suggestions without re-calling the LLM.
    Now includes `original_body` for the Approvals tab original email preview (Fix 8).
    """
    email_repo = EmailRepository(session)
    all_emails = await email_repo.get_by_user(user_id, limit=200)
    email_ids = [e.id for e in all_emails]
    email_map = {str(e.id): e for e in all_emails}

    summary_repo = EmailSummaryRepository(session)
    summaries = await summary_repo.get_by_user_emails(email_ids)

    results = []
    for s in summaries:
        email = email_map.get(str(s.email_id))
        action = s.category or "reminder"
        results.append({
            "email_id": str(s.email_id),
            "subject": email.subject if email else "",
            "sender": email.sender_name or email.sender if email else "",
            "sender_email": email.sender if email else "",
            "received_at": email.received_at.isoformat() if email and email.received_at else None,
            "summary": s.summary,
            "action": action,
            "reply_draft": s.suggested_action if action == "reply" else None,
            "reminder_reason": s.suggested_action if action == "reminder" else None,
            "priority": s.priority,
            "approval_status": s.approval_status or "pending",
            # Fix 8: Include original email body for Approvals tab preview
            "original_body": (email.body_text or email.snippet or "") if email else "",
        })

    return results


async def analyze_single_email(
    session: AsyncSession, user_id: uuid.UUID, email_id: uuid.UUID
) -> dict | None:
    """
    Run AI analysis on a single email (for individual email analysis button).
    Returns the suggestion dict or None if the email is not found.
    Always re-analyses even if the email was previously processed.
    """
    from sqlalchemy import select
    from app.models.email import Email

    # Fetch user for name (Fix 3) and email (Fix 2)
    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)
    user_email = user.email if user else ""
    user_name = user.name if user else "the user"

    stmt = (
        select(Email)
        .where(Email.id == email_id)
        .where(Email.user_id == user_id)
    )
    result = await session.execute(stmt)
    email = result.scalar_one_or_none()
    if not email:
        return None

    # Fix 1 + 2: Skip no-reply and outgoing even for single analysis
    if _is_no_reply(email.sender):
        logger.info("Skipping single analysis for no-reply sender: %s", email.sender)
        return {
            "email_id": str(email_id),
            "subject": email.subject,
            "sender": email.sender_name or email.sender,
            "sender_email": email.sender,
            "received_at": email.received_at.isoformat() if email.received_at else None,
            "summary": "Automated email — no action required.",
            "action": "none",
            "reply_draft": None,
            "reminder_reason": None,
            "priority": 5,
            "approval_status": "pending",
        }

    if _is_outgoing(email.labels, email.sender, user_email):
        logger.info("Skipping single analysis for outgoing email: %s", email.sender)
        return {
            "email_id": str(email_id),
            "subject": email.subject,
            "sender": email.sender_name or email.sender,
            "sender_email": email.sender,
            "received_at": email.received_at.isoformat() if email.received_at else None,
            "summary": "This is an email you sent — no action required.",
            "action": "none",
            "reply_draft": None,
            "reminder_reason": None,
            "priority": 5,
            "approval_status": "pending",
        }

    prompt = _build_prompt([{
        "email_id": str(email.id),
        "subject": email.subject,
        "sender": email.sender_name or email.sender,
        "sender_email": email.sender,
        "body": (email.body_text or email.snippet or "")[:2000],
    }], user_name)

    raw = await _call_openrouter_with_fallback(prompt)

    try:
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])
            text = text.rsplit("```", 1)[0].strip()
        parsed: list[dict] = json.loads(text)
        if not parsed:
            return None
        item = parsed[0]
    except (json.JSONDecodeError, IndexError) as exc:
        logger.error("Failed to parse single-email LLM response: %s", exc)
        raise ValueError(f"AI returned invalid JSON: {exc}") from exc

    action = item.get("action", "reminder")
    summary_repo = EmailSummaryRepository(session)
    await summary_repo.upsert(
        email_id=email_id,
        summary=item.get("summary", ""),
        action=action,
        reply_draft=item.get("reply_draft"),
        reminder_reason=item.get("reminder_reason"),
        priority=int(item.get("priority", 3)),
    )

    email_repo = EmailRepository(session)
    await email_repo.mark_as_processed(email_id)

    # Fix 5: Auto-create Reminder for single email analysis too
    if action == "reminder":
        reminder_repo = ReminderRepository(session)
        await _auto_create_reminder(
            reminder_repo=reminder_repo,
            user_id=user_id,
            email_id=email_id,
            subject=email.subject,
            note=item.get("reminder_reason"),
        )

    await session.commit()

    return {
        "email_id": str(email_id),
        "subject": email.subject,
        "sender": email.sender_name or email.sender,
        "sender_email": email.sender,
        "received_at": email.received_at.isoformat() if email.received_at else None,
        "summary": item.get("summary", ""),
        "action": action,
        "reply_draft": item.get("reply_draft") if action == "reply" else None,
        "reminder_reason": item.get("reminder_reason") if action == "reminder" else None,
        "priority": int(item.get("priority", 3)),
        "approval_status": "pending",
        # Fix 8: Include original body
        "original_body": email.body_text or email.snippet or "",
    }


# ─── Fix 5: Auto-create Reminder helper ──────────────────────

async def _auto_create_reminder(
    reminder_repo: ReminderRepository,
    user_id: uuid.UUID,
    email_id: uuid.UUID,
    subject: str,
    note: str | None,
) -> None:
    """
    Automatically persist a Reminder row when the AI decides action="reminder".
    Sets remind_at to 24 hours from now as a sensible default.
    Silently skips if a reminder for this email already exists.
    """
    try:
        # Check if a reminder already exists for this email to avoid duplicates
        from sqlalchemy import select
        from app.models.reminder import Reminder
        existing_stmt = (
            select(Reminder)
            .where(Reminder.email_id == email_id)
            .where(Reminder.user_id == user_id)
            .where(Reminder.is_completed.is_(False))
        )
        result = await reminder_repo.session.execute(existing_stmt)
        existing = result.scalar_one_or_none()
        if existing:
            logger.info("Reminder already exists for email_id=%s — skipping auto-create", email_id)
            return

        remind_at = datetime.now(timezone.utc) + timedelta(days=1)
        await reminder_repo.create({
            "user_id": user_id,
            "email_id": email_id,
            "subject": subject,
            "note": note,
            "remind_at": remind_at,
        })
        logger.info("Auto-created reminder for email_id=%s", email_id)
    except Exception as exc:
        logger.warning("Failed to auto-create reminder for email_id=%s: %s", email_id, exc)


# ─── OpenRouter Caller with Fallback ─────────────────────────

async def _call_openrouter_with_fallback(prompt: str) -> str:
    """
    Try the primary model first, then fall back through _FALLBACK_MODELS.
    Each model gets one attempt. Raises QuotaExhaustedError if all fail.
    """
    models_to_try = [_OPENROUTER_MODEL] + _FALLBACK_MODELS

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://superclerk.app",
        "X-Title": "SuperClerk AI",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        for model_name in models_to_try:
            try:
                logger.info("Calling OpenRouter model=%s", model_name)
                resp = await client.post(
                    _OPENROUTER_URL,
                    headers=headers,
                    json={
                        "model": model_name,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                        "response_format": {"type": "json_object"},
                    },
                )

                if resp.status_code == 429:
                    logger.warning(
                        "OpenRouter rate-limited on model=%s — trying next", model_name
                    )
                    continue

                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    logger.info(
                        "OpenRouter call succeeded: model=%s tokens_used=%s",
                        model_name,
                        data.get("usage", {}).get("total_tokens", "?"),
                    )
                    return content

                # Other HTTP error — log and try next model
                logger.warning(
                    "OpenRouter error model=%s status=%d body=%s",
                    model_name, resp.status_code, resp.text[:300],
                )

            except httpx.TimeoutException:
                logger.warning("OpenRouter timeout on model=%s — trying next", model_name)
            except Exception as exc:
                logger.warning(
                    "OpenRouter unexpected error on model=%s: %s — trying next",
                    model_name, exc,
                )

    raise QuotaExhaustedError(
        "All AI models are currently unavailable or rate-limited. "
        "Please wait a minute and try again."
    )


# ─── Prompt Builder ──────────────────────────────────────────

def _build_prompt(email_list: list[dict], user_name: str = "the user") -> str:
    """
    Build the LLM analysis prompt.
    Fix 3: Injects user_name so the AI signs replies correctly.
    """
    emails_json = json.dumps(email_list, indent=2, ensure_ascii=False)
    return f"""You are a highly capable executive assistant working on behalf of {user_name}.
Your job is to analyse incoming emails and prepare responses exactly as {user_name} would write them.

Analyse the following unread emails and return a JSON array with one object per email.

Rules:
- Choose action "reply" if the email requires a direct response (question, inquiry, complaint, request, follow-up, meeting invite).
- Choose action "reminder" if the email is informational but needs attention later (invoice, deadline, notification, newsletter with key info, promo with expiry).
- Choose action "none" if the email requires no action and is purely informational (receipt, spam, generic newsletter, automated notification, "thank you" email with no ask).
- For action "reply": Write a professional, concise reply in the first person as {user_name}. Address the sender's exact question or request. Sign off with just the name: {user_name}.
- For action "reminder": Write reminder_reason as a short sentence explaining what to follow up on and by when (if a date is mentioned in the email).
- NEVER mention AI, SuperClerk, or any assistant in the reply draft.
- priority: 1=urgent/critical, 2=high, 3=medium, 4=low, 5=ignore (newsletters, spam)

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {{
    "email_id": "<exact id from input>",
    "summary": "<1-2 sentence summary of what the email is about>",
    "action": "reply", "reminder", or "none",
    "reply_draft": "<full reply text if action=reply, else null>",
    "reminder_reason": "<brief follow-up reason if action=reminder, else null>",
    "priority": <integer 1-5>
  }}
]

Emails to analyse:
{emails_json}"""
