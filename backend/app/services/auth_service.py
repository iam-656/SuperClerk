# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Auth Service
# Business logic for Google OAuth user sync and JWT management.
# ─────────────────────────────────────────────────────────────

import logging
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserRead

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── JWT Config ─────────────────────────────────────────────
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


# ─── Token Helpers ───────────────────────────────────────────

def create_access_token(user_id: uuid.UUID, email: str) -> str:
    """
    Create a signed HS256 JWT.
    Payload includes: sub (user_id), email, iat, exp.
    Signing key: AI_AGENT_SECRET from .env
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.ai_agent_secret, algorithm=ALGORITHM)


def verify_access_token(token: str) -> dict:
    """
    Decode and validate a JWT. Returns the payload dict.
    Raises JWTError (401) if invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.ai_agent_secret, algorithms=[ALGORITHM])
        if not payload.get("sub"):
            raise JWTError("Missing sub claim")
        return payload
    except JWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise


# ─── User Sync ───────────────────────────────────────────────

async def sync_google_user(
    session: AsyncSession,
    google_id: str,
    email: str,
    name: str,
    avatar_url: str | None,
) -> tuple[UserRead, bool]:
    """
    Upsert the Google-authenticated user into the DB.

    Returns:
        (UserRead, is_new_user) — bool is True on first-ever sign-in.
    """
    repo = UserRepository(session)

    # Check if user exists before upsert to detect new users
    existing = await repo.get_by_google_id(google_id)
    is_new = existing is None

    user = await repo.upsert_from_google(
        google_id=google_id,
        email=email,
        name=name,
        avatar_url=avatar_url,
    )
    await session.commit()
    await session.refresh(user)

    logger.info(
        "User %s | google_id=%s | new=%s",
        user.email,
        google_id,
        is_new,
    )
    return UserRead.model_validate(user), is_new
