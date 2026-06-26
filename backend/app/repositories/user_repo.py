# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — User Repository
# ─────────────────────────────────────────────────────────────

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base_repo import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        """Find a user by their email address."""
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_google_id(self, google_id: str) -> User | None:
        """Find a user by their Google OAuth sub claim."""
        stmt = select(User).where(User.google_id == google_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_from_google(
        self,
        google_id: str,
        email: str,
        name: str,
        avatar_url: str | None,
    ) -> User:
        """
        Create a new user from Google OAuth data, or update their
        name and avatar if they already exist. Returns the user.
        """
        existing = await self.get_by_google_id(google_id)
        if existing:
            existing.name = name
            existing.avatar_url = avatar_url
            await self.session.flush()
            await self.session.refresh(existing)
            return existing

        return await self.create(
            {
                "google_id": google_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
            }
        )
