# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Repositories Package
# ─────────────────────────────────────────────────────────────

from app.repositories.base_repo import BaseRepository
from app.repositories.user_repo import UserRepository
from app.repositories.email_repo import EmailRepository
from app.repositories.approval_repo import ApprovalRepository

__all__ = [
    "BaseRepository",
    "UserRepository",
    "EmailRepository",
    "ApprovalRepository",
]
