# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Google Calendar Service
# Wraps the Google Calendar API.
# ─────────────────────────────────────────────────────────────

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.google_auth_service import get_google_credentials

logger = logging.getLogger(__name__)

async def get_freebusy(
    session: AsyncSession, user_id: uuid.UUID, time_min: datetime, time_max: datetime
) -> list[dict]:
    """
    Query the user's primary calendar for FreeBusy info between time_min and time_max.
    Returns a list of busy intervals: [{"start": "...", "end": "..."}]
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return []

    calendar_api = build("calendar", "v3", credentials=creds, cache_discovery=False)
    
    body = {
        "timeMin": time_min.isoformat(),
        "timeMax": time_max.isoformat(),
        "items": [{"id": "primary"}],
    }

    try:
        response = await asyncio.to_thread(
            lambda: calendar_api.freebusy().query(body=body).execute()
        )
        busy_times = response.get("calendars", {}).get("primary", {}).get("busy", [])
        return busy_times
    except Exception as exc:
        logger.error("Failed to query FreeBusy for user_id=%s: %s", user_id, exc)
        return []

async def create_event(
    session: AsyncSession, 
    user_id: uuid.UUID, 
    title: str, 
    start_time: datetime, 
    end_time: datetime,
    description: str | None = None,
    color_id: str | None = None,
    all_day: bool = False
) -> str | None:
    """
    Create an event in the user's primary calendar.
    Returns the google_event_id.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return None

    calendar_api = build("calendar", "v3", credentials=creds, cache_discovery=False)
    
    event_body = {
        "summary": title,
        "description": description or "",
    }
    
    if color_id:
        event_body["colorId"] = color_id

    if all_day:
        # All-day events require just a date string (YYYY-MM-DD)
        event_body["start"] = {"date": start_time.strftime("%Y-%m-%d")}
        # End date is exclusive for all-day events in Google Calendar
        exclusive_end = (end_time + timedelta(days=1)).strftime("%Y-%m-%d")
        event_body["end"] = {"date": exclusive_end}
    else:
        event_body["start"] = {"dateTime": start_time.isoformat()}
        event_body["end"] = {"dateTime": end_time.isoformat()}

    try:
        event = await asyncio.to_thread(
            lambda: calendar_api.events().insert(calendarId="primary", body=event_body).execute()
        )
        logger.info("Created Google Event %s for user_id=%s", event.get("id"), user_id)
        return event.get("id")
    except Exception as exc:
        logger.error("Failed to create Google Event for user_id=%s: %s", user_id, exc)
        return None

async def list_upcoming_meetings(
    session: AsyncSession, user_id: uuid.UUID, time_min: datetime, time_max: datetime
) -> list[dict]:
    """
    List events on the primary calendar starting between time_min and time_max.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return []

    calendar_api = build("calendar", "v3", credentials=creds, cache_discovery=False)
    
    try:
        response = await asyncio.to_thread(
            lambda: calendar_api.events().list(
                calendarId="primary",
                timeMin=time_min.isoformat(),
                timeMax=time_max.isoformat(),
                singleEvents=True,
                orderBy="startTime"
            ).execute()
        )
        return response.get("items", [])
    except Exception as exc:
        logger.error("Failed to list upcoming meetings for user_id=%s: %s", user_id, exc)
        return []

async def patch_event_description(
    session: AsyncSession, user_id: uuid.UUID, event_id: str, new_description: str
) -> bool:
    """
    Patch an event's description.
    """
    creds = await get_google_credentials(session, user_id)
    if not creds:
        return False

    calendar_api = build("calendar", "v3", credentials=creds, cache_discovery=False)
    
    try:
        await asyncio.to_thread(
            lambda: calendar_api.events().patch(
                calendarId="primary", eventId=event_id, body={"description": new_description}
            ).execute()
        )
        logger.info("Patched Google Event %s for user_id=%s", event_id, user_id)
        return True
    except Exception as exc:
        logger.error("Failed to patch Google Event %s for user_id=%s: %s", event_id, user_id, exc)
        return False
