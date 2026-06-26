# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Approval Model
# Human-In-The-Loop approval record for agent actions.
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Approval(Base):
    """HITL approval record — CEO approves or rejects an agent action."""

    __tablename__ = "approvals"

    # ─── Primary Key ────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # ─── Foreign Keys ────────────────────────────────────────
    agent_action_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_actions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ─── Approval State ──────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
        comment="pending | approved | rejected",
    )
    feedback: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional CEO note when approving or rejecting",
    )

    # ─── Timestamps ─────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the CEO approved or rejected",
    )

    # ─── Relationships ───────────────────────────────────────
    agent_action: Mapped["AgentAction"] = relationship(
        "AgentAction", back_populates="approval"
    )

    def __repr__(self) -> str:
        return f"<Approval id={self.id} status={self.status}>"
