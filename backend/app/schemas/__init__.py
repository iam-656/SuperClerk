# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Schemas Package
# ─────────────────────────────────────────────────────────────

from app.schemas.common import (
    APIResponse,
    PaginatedResponse,
    HealthStatus,
    ErrorDetail,
)
from app.schemas.user import UserCreate, UserUpdate, UserRead
from app.schemas.email import EmailCreate, EmailUpdate, EmailRead
from app.schemas.approval import ApprovalCreate, ApprovalRead, ApprovalDecision

__all__ = [
    "APIResponse",
    "PaginatedResponse",
    "HealthStatus",
    "ErrorDetail",
    "UserCreate",
    "UserUpdate",
    "UserRead",
    "EmailCreate",
    "EmailUpdate",
    "EmailRead",
    "ApprovalCreate",
    "ApprovalRead",
    "ApprovalDecision",
]
