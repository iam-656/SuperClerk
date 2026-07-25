# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Reminder Model
# Represents a scheduled reminder for an email.
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Reminder(Base):
    """A scheduled reminder linked to an email."""

    __tablename__ = "reminders"

    # ─── Primary Key ────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # ─── Foreign Keys ───────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ─── Reminder Data ───────────────────────────────────────
    subject: Mapped[str] = mapped_column(
        String,
        nullable=False,
        comment="Snapshot of the email subject for quick display",
    )
    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="User-provided note on what to do",
    )
    remind_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When the reminder is due",
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    google_task_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="Linked Google Task ID for priority morphing",
    )
    google_event_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="Linked Google Calendar Event ID for focus blocks",
    )
    task_type: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="Type of task (e.g. 'follow_up', 'focus')",
    )

    # ─── Timestamps ─────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ─── Relationships ───────────────────────────────────────
    user: Mapped["User"] = relationship("User")
    email: Mapped["Email"] = relationship("Email")

    def __repr__(self) -> str:
        return f"<Reminder email_id={self.email_id} remind_at={self.remind_at}>"
