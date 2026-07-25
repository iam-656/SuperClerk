# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Predictive Auto-Scheduler (Feature 1)
# Finds the first available 1-hour block in the user's calendar
# and concurrently creates a Google Task and Focus Time Event.
# ─────────────────────────────────────────────────────────────

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.calendar_service import get_freebusy, create_event
from app.services.tasks_service import create_google_task

logger = logging.getLogger(__name__)

def _find_first_available_slot(
    busy_times: list[dict], search_start: datetime, duration_hrs: int = 1
) -> tuple[datetime, datetime] | None:
    """
    Find the first continuous `duration_hrs` block of free time 
    between 9 AM and 5 PM (local time of the server/user) within the next 48 hours.
    Assumes `search_start` is timezone-aware (UTC).
    """
    # Helper to check if a time is during business hours (9 to 17)
    def is_business_hours(dt: datetime) -> bool:
        # In a real app, this should use the user's timezone.
        # For this prototype, we'll assume UTC is close enough or use naive local time.
        return 9 <= dt.hour < 17

    duration = timedelta(hours=duration_hrs)
    
    # We will slide a window of `duration` across the next 48 hours in 30-min increments
    current_time = search_start
    # Round up to next 30 min boundary
    minute = 30 if current_time.minute < 30 else 0
    hour = current_time.hour if minute == 30 else current_time.hour + 1
    current_time = current_time.replace(minute=minute, second=0, microsecond=0)
    if minute == 0:
        current_time += timedelta(hours=1)
        current_time = current_time.replace(hour=hour % 24)
        if hour >= 24:
            current_time += timedelta(days=1)

    end_limit = search_start + timedelta(hours=48)

    while current_time + duration <= end_limit:
        slot_end = current_time + duration
        
        # Check if entire slot is within business hours
        if is_business_hours(current_time) and is_business_hours(slot_end - timedelta(minutes=1)):
            # Check for overlaps with busy_times
            overlap = False
            for busy in busy_times:
                busy_start = datetime.fromisoformat(busy["start"].replace('Z', '+00:00'))
                busy_end = datetime.fromisoformat(busy["end"].replace('Z', '+00:00'))
                
                # Overlap condition
                if current_time < busy_end and slot_end > busy_start:
                    overlap = True
                    break
            
            if not overlap:
                return current_time, slot_end

        # Advance by 30 mins
        current_time += timedelta(minutes=30)
    
    return None

async def auto_schedule_task(
    session: AsyncSession, user_id: uuid.UUID, action_title: str, duration_hrs: int = 1, is_urgent: bool = False
) -> tuple[str | None, str | None, datetime]:
    """
    1. Queries FreeBusy
    2. Finds a slot
    3. Concurrently creates Task + Calendar Event
    Returns (task_id, event_id, scheduled_start_time)
    """
    now = datetime.now(timezone.utc)
    time_max = now + timedelta(hours=48)

    busy_times = await get_freebusy(session, user_id, now, time_max)
    
    slot = _find_first_available_slot(busy_times, now, duration_hrs)
    if not slot:
        logger.warning("No available time block found for user=%s. Defaulting to tomorrow 9AM.", user_id)
        # Fallback to tomorrow 9AM
        tomorrow = now + timedelta(days=1)
        start_time = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=duration_hrs)
    else:
        start_time, end_time = slot

    task_title = f"[URGENT] {action_title}" if is_urgent else action_title

    # Concurrently execute both API calls
    task_id, event_id = await asyncio.gather(
        create_google_task(
            session=session,
            user_id=user_id,
            title=task_title,
            due_date=start_time
        ),
        create_event(
            session=session,
            user_id=user_id,
            title=f"Focus Time: {action_title}",
            start_time=start_time,
            end_time=end_time,
            description="Auto-scheduled by SuperClerk AI.",
            color_id="1"  # 1 = Lavender / Focus color
        )
    )

    logger.info(
        "Auto-scheduled %s for user=%s at %s (Task=%s, Event=%s)", 
        action_title, user_id, start_time, task_id, event_id
    )
    
    return task_id, event_id, start_time
