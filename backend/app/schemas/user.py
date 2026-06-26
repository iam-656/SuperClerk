# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — User Schemas
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    email: EmailStr
    name: str
    avatar_url: str | None = None


class UserCreate(UserBase):
    google_id: str


class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None
    is_active: bool | None = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    google_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
