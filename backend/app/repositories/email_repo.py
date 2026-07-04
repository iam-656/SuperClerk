# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Email Repository
# ─────────────────────────────────────────────────────────────

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email import Email
from app.repositories.base_repo import BaseRepository


class EmailRepository(BaseRepository[Email]):
    model = Email

    async def get_by_gmail_id(self, gmail_id: str) -> Email | None:
        """Find an email by its Gmail message ID (deduplication check)."""
        stmt = select(Email).where(Email.gmail_id == gmail_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user(
        self,
        user_id: uuid.UUID,
        *,
        unread_only: bool = False,
        unprocessed_only: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Email]:
        """Return paginated emails for a user with optional filters."""
        stmt = (
            select(Email)
            .where(Email.user_id == user_id)
            .order_by(Email.received_at.desc())
            .offset(offset)
            .limit(limit)
        )
        if unread_only:
            stmt = stmt.where(Email.is_read.is_(False))
        if unprocessed_only:
            stmt = stmt.where(Email.is_processed.is_(False))

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def mark_as_read(self, email_id: uuid.UUID) -> Email | None:
        """Mark an email as read."""
        return await self.update(email_id, {"is_read": True})

    async def mark_as_processed(self, email_id: uuid.UUID) -> Email | None:
        """Mark an email as processed by the AI agent."""
        return await self.update(email_id, {"is_processed": True})

    async def bulk_upsert_emails(
        self, user_id: uuid.UUID, emails_data: list[dict]
    ) -> tuple[int, int]:
        """
        Insert multiple emails, skipping any that already exist by gmail_id.
        Returns (inserted_count, skipped_count).
        """
        inserted = 0
        skipped = 0
        for data in emails_data:
            existing = await self.get_by_gmail_id(data["gmail_id"])
            if existing:
                skipped += 1
                continue
            await self.create({**data, "user_id": user_id})
            inserted += 1
        return inserted, skipped

