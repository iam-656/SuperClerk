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
        Find an existing user by google_id OR email, then update their profile.
        If no user exists, create one.

        We look up by email as a fallback because the google_id sent by the
        frontend may be a NextAuth-generated UUID (not the stable Google sub),
        which changes between sessions. Email is the stable, unique identifier.
        """
        # Primary lookup: by google_id (stable if frontend sends real Google sub)
        existing = await self.get_by_google_id(google_id)

        # Fallback: by email (handles when google_id is a session UUID)
        if existing is None:
            existing = await self.get_by_email(email)

        if existing:
            # Always keep google_id up-to-date in case it changes (e.g. re-auth)
            existing.google_id = google_id
            existing.name = name
            if avatar_url:
                existing.avatar_url = avatar_url
            await self.session.flush()
            await self.session.refresh(existing)
            return existing

        # No existing user — create fresh
        return await self.create(
            {
                "google_id": google_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
            }
        )
