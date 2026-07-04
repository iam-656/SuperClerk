# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Connected Account Repository
# Stores and retrieves OAuth tokens (access + refresh) per user.
# ─────────────────────────────────────────────────────────────

import uuid
from datetime import datetime
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.connected_account import ConnectedAccount
from app.repositories.base_repo import BaseRepository


class ConnectedAccountRepository(BaseRepository[ConnectedAccount]):
    model = ConnectedAccount

    async def get_by_user_and_provider(
        self,
        user_id: uuid.UUID,
        provider: str,
    ) -> ConnectedAccount | None:
        """Find a connected account by user and provider (e.g. 'google')."""
        stmt = select(ConnectedAccount).where(
            and_(
                ConnectedAccount.user_id == user_id,
                ConnectedAccount.provider == provider,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_google_accounts(self) -> list[ConnectedAccount]:
        """Return all Google connected accounts — used by the 15-min scheduler."""
        stmt = select(ConnectedAccount).where(
            ConnectedAccount.provider == "google"
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_history_id(
        self,
        account_id: uuid.UUID,
        history_id: str,
    ) -> None:
        """Persist the latest Gmail historyId after a successful sync."""
        account = await self.get_by_id(account_id)
        if account:
            account.last_history_id = history_id
            await self.session.flush()

    async def upsert_google_tokens(
        self,
        user_id: uuid.UUID,
        provider_account_id: str,
        access_token: str,
        refresh_token: str | None,
        scopes: list[str] | None,
        expires_at: datetime | None,
    ) -> ConnectedAccount:
        """
        Create or update the Google connected account for a user.
        Always refreshes access_token, refresh_token, scopes, expires_at.
        """
        existing = await self.get_by_user_and_provider(user_id, "google")

        if existing:
            existing.access_token = access_token
            if refresh_token:
                existing.refresh_token = refresh_token
            if scopes:
                existing.scopes = scopes
            existing.expires_at = expires_at
            await self.session.flush()
            await self.session.refresh(existing)
            return existing

        return await self.create(
            {
                "user_id": user_id,
                "provider": "google",
                "provider_account_id": provider_account_id,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "scopes": scopes,
                "expires_at": expires_at,
            }
        )
