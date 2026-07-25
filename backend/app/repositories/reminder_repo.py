# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Reminder Repository
# ─────────────────────────────────────────────────────────────

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder
from app.repositories.base_repo import BaseRepository


class ReminderRepository(BaseRepository[Reminder]):
    model = Reminder

    async def get_by_user(
        self,
        user_id: uuid.UUID,
        *,
        include_completed: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Reminder]:
        """Fetch reminders for a user, sorted by upcoming due date."""
        stmt = (
            select(Reminder)
            .where(Reminder.user_id == user_id)
        )
        if not include_completed:
            stmt = stmt.where(Reminder.is_completed.is_(False))
        
        # Sort by remind_at ascending (closest first)
        stmt = stmt.order_by(Reminder.remind_at.asc()).offset(offset).limit(limit)
        
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def mark_completed(self, reminder_id: uuid.UUID) -> Reminder | None:
        """Mark a reminder as completed."""
        return await self.update(reminder_id, {"is_completed": True})
