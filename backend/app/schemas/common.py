# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Common Schemas
# Shared Pydantic v2 types used across all schemas.
# ─────────────────────────────────────────────────────────────

from datetime import datetime
from typing import Any, Generic, TypeVar
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Typed wrapper for all API responses."""
    success: bool = True
    data: T | None = None
    message: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response."""
    items: list[T]
    total: int
    page: int
    page_size: int
    has_next: bool


class HealthStatus(BaseModel):
    """Response schema for GET /api/v1/health."""
    status: str
    db: str
    version: str = "1.0.0"
    timestamp: datetime


class ErrorDetail(BaseModel):
    """Standard error response body."""
    error: str
    detail: str | None = None
    code: str | None = None
