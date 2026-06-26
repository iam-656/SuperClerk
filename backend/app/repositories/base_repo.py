# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Base Repository
# Generic async CRUD operations reused by all repositories.
# ─────────────────────────────────────────────────────────────

import uuid
from typing import Any, Generic, TypeVar

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic async CRUD base. Subclass and set `model`."""

    model: type[ModelType]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, record_id: uuid.UUID) -> ModelType | None:
        """Return a single record by primary key, or None."""
        result = await self.session.get(self.model, record_id)
        return result

    async def get_all(
        self,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[ModelType]:
        """Return a paginated list of all records."""
        stmt = select(self.model).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self) -> int:
        """Return total row count for this model."""
        stmt = select(func.count()).select_from(self.model)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def create(self, data: dict[str, Any]) -> ModelType:
        """Insert a new record and return it."""
        instance = self.model(**data)
        self.session.add(instance)
        await self.session.flush()  # Get DB-generated values (e.g. id)
        await self.session.refresh(instance)
        return instance

    async def update(
        self, record_id: uuid.UUID, data: dict[str, Any]
    ) -> ModelType | None:
        """Update fields on an existing record. Returns None if not found."""
        instance = await self.get_by_id(record_id)
        if instance is None:
            return None
        for key, value in data.items():
            setattr(instance, key, value)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, record_id: uuid.UUID) -> bool:
        """Delete a record by ID. Returns True if deleted, False if not found."""
        instance = await self.get_by_id(record_id)
        if instance is None:
            return False
        await self.session.delete(instance)
        await self.session.flush()
        return True
