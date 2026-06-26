# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Agent Action Model
# Records every action the AI agent wants to take.
# These are subject to human approval before execution.
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AgentAction(Base):
    """An action proposed or taken by the AI agent."""

    __tablename__ = "agent_actions"

    # ─── Primary Key ────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # ─── Foreign Key ────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ─── Action Details ──────────────────────────────────────
    action_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="e.g. 'send_email', 'create_task', 'archive_email'",
    )
    payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Structured action parameters (e.g. reply body, recipients)",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending_approval",
        comment="pending_approval | approved | rejected | executed | failed",
    )
    error_message: Mapped[str | None] = mapped_column(
        String(2000),
        nullable=True,
        comment="Populated if status=failed",
    )

    # ─── Timestamps ─────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ─── Relationships ───────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="agent_actions")
    approval: Mapped["Approval | None"] = relationship(
        "Approval", back_populates="agent_action", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:
        return f"<AgentAction id={self.id} type={self.action_type} status={self.status}>"
