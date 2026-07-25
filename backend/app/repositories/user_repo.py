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

    # get_by_id is inherited from BaseRepository and works correctly.

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
        Find an existing user by google_id OR email, update their profile,
        and return them. Create a new user only if neither lookup finds a match.

        NOTE: We intentionally do NOT overwrite google_id on existing users.
        The frontend sends session.user.id which is a NextAuth-generated UUID
        (not the stable Google sub claim), and it changes every sign-in.
        Since google_id has a UNIQUE constraint, overwriting it would fail on
        any second sign-in that sends a different UUID. Email is the stable,
        unique identifier we use to find returning users.
        """
        # Primary lookup: by google_id (works if frontend sends stable Google sub)
        existing = await self.get_by_google_id(google_id)

        # Fallback: by email (handles NextAuth session UUIDs that change each login)
        if existing is None:
            existing = await self.get_by_email(email)

        if existing:
            # Update mutable fields only — never touch google_id (UNIQUE constraint)
            existing.name = name
            if avatar_url:
                existing.avatar_url = avatar_url
            await self.session.flush()
            await self.session.refresh(existing)
            return existing

        # Truly new user — create fresh row
        return await self.create(
            {
                "google_id": google_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
            }
        )
