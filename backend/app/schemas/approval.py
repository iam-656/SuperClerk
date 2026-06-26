# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Approval Schemas
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ApprovalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_action_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    feedback: str | None
    created_at: datetime
    resolved_at: datetime | None


class ApprovalDecision(BaseModel):
    """Request body for CEO approve/reject decision."""
    status: str  # "approved" | "rejected"
    feedback: str | None = None


class ApprovalCreate(BaseModel):
    agent_action_id: uuid.UUID
    user_id: uuid.UUID
