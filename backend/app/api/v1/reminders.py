# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Reminders Router
# GET /api/v1/reminders
# POST /api/v1/reminders
# PATCH /api/v1/reminders/{id}/complete
# ─────────────────────────────────────────────────────────────

import logging
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel, Field

from app.api.deps import DBSession
from app.services.auth_service import verify_access_token
from app.repositories.reminder_repo import ReminderRepository
from app.repositories.email_repo import EmailRepository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reminders", tags=["Reminders"])
bearer_scheme = HTTPBearer()

# ─── Auth helper ─────────────────────────────────────────────

async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> uuid.UUID:
    try:
        payload = verify_access_token(credentials.credentials)
        return uuid.UUID(payload["sub"])
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

CurrentUser = Annotated[uuid.UUID, Depends(get_current_user_id)]

# ─── Schemas ─────────────────────────────────────────────────

class CreateReminderRequest(BaseModel):
    email_id: uuid.UUID
    remind_at: datetime
    note: str | None = None

    # We could do a Pydantic validator here, but we will do it in the endpoint 
    # to use timezone-aware datetime easily.

class ReminderResponse(BaseModel):
    id: uuid.UUID
    email_id: uuid.UUID
    subject: str
    note: str | None
    remind_at: datetime
    is_completed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── GET /reminders ──────────────────────────────────────────

@router.get(
    "",
    response_model=list[ReminderResponse],
    summary="List all pending reminders for the user",
)
async def list_reminders(
    db: DBSession,
    user_id: CurrentUser,
):
    repo = ReminderRepository(db)
    reminders = await repo.get_by_user(user_id, include_completed=False, limit=100)
    return reminders


# ─── POST /reminders ─────────────────────────────────────────

@router.post(
    "",
    response_model=ReminderResponse,
    summary="Create a new reminder",
    status_code=status.HTTP_201_CREATED,
)
async def create_reminder(
    db: DBSession,
    user_id: CurrentUser,
    body: CreateReminderRequest,
):
    # 1. Validate date > now
    from datetime import timezone
    now = datetime.now(timezone.utc)
    # Ensure body.remind_at is aware if it's not
    remind_at = body.remind_at
    if remind_at.tzinfo is None:
        remind_at = remind_at.replace(tzinfo=timezone.utc)
        
    if remind_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reminder time must be in the future.",
        )

    # 2. Verify email belongs to user and get subject
    email_repo = EmailRepository(db)
    email = await email_repo.get_by_id(body.email_id)
    if not email or email.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")

    # 3. Create reminder
    repo = ReminderRepository(db)
    reminder = await repo.create({
        "user_id": user_id,
        "email_id": body.email_id,
        "subject": email.subject,
        "note": body.note,
        "remind_at": remind_at,
    })
    await db.commit()
    return reminder


# ─── PATCH /reminders/{id}/complete ──────────────────────────

@router.patch(
    "/{reminder_id}/complete",
    response_model=ReminderResponse,
    summary="Mark a reminder as completed",
)
async def complete_reminder(
    db: DBSession,
    user_id: CurrentUser,
    reminder_id: uuid.UUID = Path(...),
):
    repo = ReminderRepository(db)
    reminder = await repo.get_by_id(reminder_id)
    if not reminder or reminder.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")

    updated = await repo.mark_completed(reminder_id)
    await db.commit()
    return updated


# ─── PATCH /reminders/{id} ────────────────────────────────────

class UpdateReminderRequest(BaseModel):
    remind_at: datetime | None = Field(default=None)
    note: str | None = Field(default=None)


@router.patch(
    "/{reminder_id}",
    response_model=ReminderResponse,
    summary="Update a reminder's time and/or note",
)
async def update_reminder(
    db: DBSession,
    user_id: CurrentUser,
    body: UpdateReminderRequest,
    reminder_id: uuid.UUID = Path(...),
):
    repo = ReminderRepository(db)
    reminder = await repo.get_by_id(reminder_id)
    if not reminder or reminder.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")

    update_data: dict = {}

    if body.remind_at is not None:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        remind_at = body.remind_at
        if remind_at.tzinfo is None:
            remind_at = remind_at.replace(tzinfo=timezone.utc)
        if remind_at <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reminder time must be in the future.",
            )
        update_data["remind_at"] = remind_at

    if body.note is not None:
        update_data["note"] = body.note

    if not update_data:
        return reminder  # nothing to change

    updated = await repo.update(reminder_id, update_data)
    await db.commit()
    return updated

