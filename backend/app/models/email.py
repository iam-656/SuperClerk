# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Email Model
# Raw email data fetched from Gmail API.
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Email(Base):
    """Stores raw emails fetched from Gmail."""

    __tablename__ = "emails"

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

    # ─── Gmail Identifiers ───────────────────────────────────
    gmail_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        comment="Gmail message ID",
    )
    thread_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Gmail thread ID",
    )

    # ─── Email Content ───────────────────────────────────────
    sender: Mapped[str] = mapped_column(String(320), nullable=False)
    sender_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient: Mapped[str | None] = mapped_column(String(320), nullable=True)
    subject: Mapped[str] = mapped_column(String(998), nullable=False)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ─── Status ──────────────────────────────────────────────
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_processed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="True when the AI agent has analysed this email",
    )
    labels: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
        comment="Gmail label IDs",
    )

    # ─── Timestamps ─────────────────────────────────────────
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ─── Relationships ───────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="emails")
    summary: Mapped["EmailSummary | None"] = relationship(
        "EmailSummary", back_populates="email", cascade="all, delete-orphan", uselist=False
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="email", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Email id={self.id} subject={self.subject[:40]!r}>"
