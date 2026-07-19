# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — AI Email Analysis Service
# Uses Gemini 2.0 Flash to analyse unread emails and suggest
# actions (reply or set reminder) with pre-written drafts.
# ─────────────────────────────────────────────────────────────

import asyncio
import json
import logging
import uuid

import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories.email_repo import EmailRepository
from app.repositories.email_summary_repo import EmailSummaryRepository

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Main analysis entry point ───────────────────────────────

async def analyze_unread_emails(
    session: AsyncSession, user_id: uuid.UUID
) -> list[dict]:
    """
    Fetch all unread+unprocessed emails for `user_id`, send them to
    Gemini 2.0 Flash in a single batched prompt, persist the results to
    email_summaries, mark emails as processed, and return the analysis.

    Returns a list of dicts:
    [
      {
        "email_id": "<uuid>",
        "summary": "...",
        "action": "reply" | "reminder",
        "reply_draft": "..." | null,
        "reminder_reason": "..." | null,
        "priority": 1-5,
      },
      ...
    ]
    """
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured in the backend .env")

    # 1. Fetch emails to analyse
    email_repo = EmailRepository(session)
    emails = await email_repo.get_unread_unprocessed(user_id, limit=20)

    if not emails:
        return []

    # 2. Build structured payload for Gemini
    email_list = []
    for e in emails:
        email_list.append({
            "email_id": str(e.id),
            "subject": e.subject,
            "sender": e.sender_name or e.sender,
            "sender_email": e.sender,
            "body": (e.body_text or e.snippet or "")[:2000],
        })

    prompt = _build_prompt(email_list)

    # 3. Call Gemini (blocking I/O → thread)
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    try:
        response = await asyncio.to_thread(
            model.generate_content,
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                response_mime_type="application/json",
            ),
        )
        raw = response.text.strip()
    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc, exc_info=True)
        raise

    # 4. Parse JSON response (Gemini returns pure JSON with response_mime_type)
    try:
        results: list[dict] = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Gemini JSON response: %s\nRaw: %s", exc, raw)
        raise ValueError(f"Gemini returned invalid JSON: {exc}") from exc

    # 5. Persist to email_summaries and mark emails processed
    summary_repo = EmailSummaryRepository(session)
    valid_email_ids = {str(e.id) for e in emails}

    for result in results:
        eid_str = result.get("email_id", "")
        if eid_str not in valid_email_ids:
            logger.warning("Gemini returned unknown email_id %s — skipping", eid_str)
            continue
        try:
            email_id = uuid.UUID(eid_str)
            await summary_repo.upsert(
                email_id=email_id,
                summary=result.get("summary", ""),
                action=result.get("action", "reminder"),
                reply_draft=result.get("reply_draft"),
                reminder_reason=result.get("reminder_reason"),
                priority=int(result.get("priority", 3)),
            )
            await email_repo.mark_as_processed(email_id)
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
    Used so the frontend can reload suggestions without re-calling Gemini.
    """
    email_repo = EmailRepository(session)
    # Get all emails (read or unread, processed or not) so we can look up summaries
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
            "summary": s.summary,
            "action": action,
            "reply_draft": s.suggested_action if action == "reply" else None,
            "reminder_reason": s.suggested_action if action == "reminder" else None,
            "priority": s.priority,
        })

    return results


# ─── Prompt Builder ──────────────────────────────────────────

def _build_prompt(email_list: list[dict]) -> str:
    emails_json = json.dumps(email_list, indent=2, ensure_ascii=False)
    return f"""You are SuperClerk AI, an intelligent business inbox assistant.

Analyse the following unread emails and return a JSON array with one object per email.

Rules:
- Choose action "reply" if the email requires a direct response (question, inquiry, complaint, request, follow-up, meeting invite).
- Choose action "reminder" if the email is informational but needs attention later (invoice, deadline, notification, newsletter with key info, promo with expiry).
- Write reply_draft in a professional but concise tone. Address the sender's exact question/request. Sign off as the user.
- Write reminder_reason as a short sentence explaining what to remember and by when (if a date is mentioned).
- priority: 1=urgent/critical, 2=high, 3=medium, 4=low, 5=ignore (newsletters, spam)

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {{
    "email_id": "<exact id from input>",
    "summary": "<1-2 sentence summary of what the email is about>",
    "action": "reply" or "reminder",
    "reply_draft": "<full reply text if action=reply, else null>",
    "reminder_reason": "<brief follow-up reason if action=reminder, else null>",
    "priority": <integer 1-5>
  }}
]

Emails to analyse:
{emails_json}"""
