# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Connected Account Model
# Stores OAuth tokens for Google/Gmail per user.
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ConnectedAccount(Base):
    """OAuth token storage for a user's connected external accounts (e.g. Gmail)."""

    __tablename__ = "connected_accounts"

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

    # ─── Provider Info ───────────────────────────────────────
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="e.g. 'google', 'microsoft'",
    )
    provider_account_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Provider's user/account ID",
    )

    # ─── OAuth Tokens ────────────────────────────────────────
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    scopes: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
        comment="Granted OAuth scopes",
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ─── Gmail Sync Cursor ───────────────────────────────────
    last_history_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Gmail historyId from the last incremental sync. Used to fetch only new changes.",
    )

    # ─── Timestamps ─────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ─── Relationships ───────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="connected_accounts")

    def __repr__(self) -> str:
        return f"<ConnectedAccount user_id={self.user_id} provider={self.provider}>"
