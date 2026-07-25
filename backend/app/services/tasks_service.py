# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Google Tasks Service
# Wraps the Google Tasks API.
# ─────────────────────────────────────────────────────────────

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.google_auth_service import get_google_credentials

logger = logging.getLogger(__name__)

async def create_google_task(
    session: AsyncSession, user_id: uuid.UUID, title: str, notes: str | None = None, due_date: datetime | None = None
) -> str | None:
    """
    Create a task in the user's default Google Tasks list.
    Returns the google_task_id.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return None

    tasks_api = build("tasks", "v1", credentials=creds, cache_discovery=False)
    
    body = {"title": title}
    if notes:
        body["notes"] = notes
    if due_date:
        # Google Tasks API expects RFC 3339 format
        body["due"] = due_date.isoformat()

    try:
        task = await asyncio.to_thread(
            lambda: tasks_api.tasks().insert(tasklist="@default", body=body).execute()
        )
        logger.info("Created Google Task %s for user_id=%s", task.get("id"), user_id)
        return task.get("id")
    except Exception as exc:
        logger.error("Failed to create Google Task for user_id=%s: %s", user_id, exc)
        return None

async def complete_google_task(
    session: AsyncSession, user_id: uuid.UUID, google_task_id: str
) -> bool:
    """
    Mark a Google Task as completed.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return False

    tasks_api = build("tasks", "v1", credentials=creds, cache_discovery=False)
    
    try:
        # First get the task to fetch its current ETag and state
        task = await asyncio.to_thread(
            lambda: tasks_api.tasks().get(tasklist="@default", task=google_task_id).execute()
        )
        task["status"] = "completed"
        await asyncio.to_thread(
            lambda: tasks_api.tasks().update(tasklist="@default", task=google_task_id, body=task).execute()
        )
        logger.info("Completed Google Task %s for user_id=%s", google_task_id, user_id)
        return True
    except Exception as exc:
        logger.error("Failed to complete Google Task %s for user_id=%s: %s", google_task_id, user_id, exc)
        return False

async def delete_google_task(
    session: AsyncSession, user_id: uuid.UUID, google_task_id: str
) -> bool:
    """
    Delete a Google Task.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return False

    tasks_api = build("tasks", "v1", credentials=creds, cache_discovery=False)
    
    try:
        await asyncio.to_thread(
            lambda: tasks_api.tasks().delete(tasklist="@default", task=google_task_id).execute()
        )
        logger.info("Deleted Google Task %s for user_id=%s", google_task_id, user_id)
        return True
    except Exception as exc:
        logger.error("Failed to delete Google Task %s for user_id=%s: %s", google_task_id, user_id, exc)
        return False

async def list_urgent_tasks(session: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """
    Fetch incomplete tasks due today with '[URGENT]' in the title.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return []

    tasks_api = build("tasks", "v1", credentials=creds, cache_discovery=False)
    
    # Due bounds for today
    now = datetime.now(timezone.utc)
    today_min = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_max = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()

    try:
        response = await asyncio.to_thread(
            lambda: tasks_api.tasks().list(
                tasklist="@default",
                showCompleted=False,
                dueMin=today_min,
                dueMax=today_max
            ).execute()
        )
        items = response.get("items", [])
        urgent_tasks = [
            task for task in items 
            if "[URGENT]" in task.get("title", "").upper()
        ]
        return urgent_tasks
    except Exception as exc:
        logger.error("Failed to list Google Tasks for user_id=%s: %s", user_id, exc)
        return []
