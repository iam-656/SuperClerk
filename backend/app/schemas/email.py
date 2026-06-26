# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Email Schemas
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EmailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    gmail_id: str
    thread_id: str | None
    sender: str
    sender_name: str | None
    subject: str
    snippet: str | None
    is_read: bool
    is_processed: bool
    labels: list[str] | None
    received_at: datetime
    created_at: datetime


class EmailCreate(BaseModel):
    gmail_id: str
    thread_id: str | None = None
    sender: str
    sender_name: str | None = None
    recipient: str | None = None
    subject: str
    body_text: str | None = None
    body_html: str | None = None
    snippet: str | None = None
    labels: list[str] | None = None
    received_at: datetime


class EmailUpdate(BaseModel):
    is_read: bool | None = None
    is_processed: bool | None = None
    labels: list[str] | None = None
