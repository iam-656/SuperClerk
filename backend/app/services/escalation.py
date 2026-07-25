# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Escalation Service (Features 3 & 4)
# Handles overdue follow-ups and priority morphing.
# ─────────────────────────────────────────────────────────────

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder
from app.repositories.email_summary_repo import EmailSummaryRepository
from app.repositories.reminder_repo import ReminderRepository
from app.services.ai_service import _call_openrouter_with_fallback
from app.services.calendar_service import create_event
from app.services.tasks_service import delete_google_task, list_urgent_tasks

logger = logging.getLogger(__name__)

async def escalate_overdue_followups(session: AsyncSession, user_id: uuid.UUID) -> None:
    """
    Feature 3: The "No-Reply" Safety Net.
    Find follow-up tasks that are overdue, draft a polite follow-up email, 
    and push it to the Approvals dashboard.
    """
    reminder_repo = ReminderRepository(session)
    now = datetime.now(timezone.utc)

    # Find incomplete follow-up tasks that are overdue
    stmt = (
        select(Reminder)
        .where(Reminder.user_id == user_id)
        .where(Reminder.task_type == "follow_up")
        .where(Reminder.is_completed.is_(False))
        .where(Reminder.remind_at < now)
    )
    result = await session.execute(stmt)
    overdue_reminders = result.scalars().all()

    if not overdue_reminders:
        return

    summary_repo = EmailSummaryRepository(session)

    for reminder in overdue_reminders:
        logger.info("Escalating overdue follow-up for email_id=%s, user=%s", reminder.email_id, user_id)
        
        # Call Gemini to draft a polite follow-up
        prompt = (
            "You are an executive assistant. You sent an email a few days ago with the subject: "
            f"'{reminder.subject}'. The recipient has not replied.\n"
            "Draft a very short, polite follow-up email checking in. "
            "Return ONLY the email body text."
        )
        try:
            draft = await _call_openrouter_with_fallback(prompt)
            # Push to Approvals (email_summaries table)
            await summary_repo.upsert(
                email_id=reminder.email_id,
                summary=f"No reply received for: {reminder.subject}",
                action="reply",
                reply_draft=draft.strip(),
                reminder_reason=None,
                priority=1, # Escalate to critical
            )
            
            # Mark the reminder as completed so we don't escalate again
            reminder.is_completed = True
            await session.commit()
            
            # Optionally complete the Google Task if it exists
            if reminder.google_task_id:
                from app.services.tasks_service import complete_google_task
                await complete_google_task(session, user_id, reminder.google_task_id)

        except Exception as exc:
            logger.error("Failed to escalate follow-up: %s", exc)


async def morph_urgent_tasks(session: AsyncSession, user_id: uuid.UUID) -> None:
    """
    Feature 4: Priority Morphing.
    Find tasks marked [URGENT] due today, remove them from Tasks, 
    and create a bright red all-day Calendar event.
    """
    urgent_tasks = await list_urgent_tasks(session, user_id)
    
    for task in urgent_tasks:
        task_id = task.get("id")
        title = task.get("title", "Urgent Task")
        logger.info("Morphing urgent task '%s' (id=%s) for user=%s", title, task_id, user_id)

        # 1. Create All-Day Calendar Event (Red = colorId 11)
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        event_id = await create_event(
            session=session,
            user_id=user_id,
            title=title,
            start_time=today,
            end_time=today,
            description="Morphed from an urgent Google Task.",
            color_id="11",
            all_day=True
        )

        # 2. Delete the Task from Google Tasks so it only appears in the Calendar
        if event_id:
            await delete_google_task(session, user_id, task_id)
