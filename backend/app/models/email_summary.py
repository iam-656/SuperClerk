# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Email Summary Model
# AI-generated analysis of an email (Phase 4+).
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EmailSummary(Base):
    """AI-generated summary and classification for an email."""

    __tablename__ = "email_summaries"

    # ─── Primary Key ────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # ─── Foreign Key ────────────────────────────────────────
    email_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ─── AI-Generated Fields ─────────────────────────────────
    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Short AI-generated summary of the email",
    )
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="e.g. 'invoice', 'inquiry', 'complaint', 'newsletter'",
    )
    sentiment: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="e.g. 'positive', 'negative', 'neutral'",
    )
    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        comment="1=critical, 2=high, 3=medium, 4=low, 5=ignore",
    )
    action_required: Mapped[bool | None] = mapped_column(
        nullable=True,
        comment="Whether the AI recommends a response/action",
    )
    suggested_action: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="AI-suggested next action (e.g. 'Reply with quote')",
    )
    approval_status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        default=None,
        comment="User decision: 'pending' | 'approved' | 'rejected'",
    )

    # ─── Timestamps ─────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ─── Relationships ───────────────────────────────────────
    email: Mapped["Email"] = relationship("Email", back_populates="summary")

    def __repr__(self) -> str:
        return f"<EmailSummary email_id={self.email_id} priority={self.priority}>"
