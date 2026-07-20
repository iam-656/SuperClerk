# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Email Summary Repository
# Upserts and retrieves Gemini-generated email analyses.
# ─────────────────────────────────────────────────────────────

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_summary import EmailSummary
from app.repositories.base_repo import BaseRepository


class EmailSummaryRepository(BaseRepository[EmailSummary]):
    model = EmailSummary

    async def get_by_email_id(self, email_id: uuid.UUID) -> EmailSummary | None:
        """Fetch the AI summary for a given email, or None if not analysed yet."""
        stmt = select(EmailSummary).where(EmailSummary.email_id == email_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_emails(
        self, email_ids: list[uuid.UUID]
    ) -> list[EmailSummary]:
        """Fetch all summaries for a list of email IDs (used to bulk-load suggestions)."""
        if not email_ids:
            return []
        stmt = select(EmailSummary).where(EmailSummary.email_id.in_(email_ids))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_approval_status(
        self, email_id: uuid.UUID, status: str
    ) -> EmailSummary | None:
        """Persist an approve/reject decision. status: 'approved' | 'rejected'"""
        existing = await self.get_by_email_id(email_id)
        if not existing:
            return None
        existing.approval_status = status
        await self.session.flush()
        await self.session.refresh(existing)
        return existing

    async def upsert(
        self,
        email_id: uuid.UUID,
        summary: str,
        action: str,           # "reply" | "reminder"
        reply_draft: str | None,
        reminder_reason: str | None,
        priority: int = 3,
    ) -> EmailSummary:
        """
        Create or update the AI summary for an email.
        - `category` stores the action type ("reply" or "reminder")
        - `suggested_action` stores the reply draft or reminder reason text
        """
        existing = await self.get_by_email_id(email_id)
        payload = {
            "summary": summary,
            "category": action,
            "priority": priority,
            "action_required": True,
            "suggested_action": reply_draft if action == "reply" else reminder_reason,
        }
        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
            await self.session.flush()
            await self.session.refresh(existing)
            return existing
        return await self.create({"email_id": email_id, **payload})
