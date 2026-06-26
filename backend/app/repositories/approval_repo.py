# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Approval Repository
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval import Approval
from app.repositories.base_repo import BaseRepository


class ApprovalRepository(BaseRepository[Approval]):
    model = Approval

    async def get_pending_for_user(self, user_id: uuid.UUID) -> list[Approval]:
        """Return all pending approvals for a user, newest first."""
        stmt = (
            select(Approval)
            .where(Approval.user_id == user_id)
            .where(Approval.status == "pending")
            .order_by(Approval.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_agent_action(self, agent_action_id: uuid.UUID) -> Approval | None:
        """Find an approval by its linked agent action."""
        stmt = select(Approval).where(
            Approval.agent_action_id == agent_action_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def resolve(
        self,
        approval_id: uuid.UUID,
        status: str,
        feedback: str | None = None,
    ) -> Approval | None:
        """Approve or reject an approval — sets resolved_at timestamp."""
        return await self.update(
            approval_id,
            {
                "status": status,
                "feedback": feedback,
                "resolved_at": datetime.now(timezone.utc),
            },
        )
