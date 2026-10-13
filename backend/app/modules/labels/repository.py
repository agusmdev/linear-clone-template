"""Label repository - database access layer."""

import uuid

from sqlalchemy import func, select

from app.modules.labels.models import Label
from app.repositories.sql_repository import SQLAlchemyRepository


class LabelRepository(SQLAlchemyRepository[Label]):
    model = Label

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Label]:
        query = (
            select(Label)
            .where(Label.workspace_id == workspace_id)
            .order_by(Label.name, Label.id)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def list_by_ids(self, label_ids: set[uuid.UUID]) -> list[Label]:
        if not label_ids:
            return []
        query = select(Label).where(Label.id.in_(label_ids)).order_by(Label.name)
        return list((await self._session.execute(query)).scalars().all())

    async def get_by_name(self, workspace_id: uuid.UUID, name: str) -> Label | None:
        """The label named ``name`` (any case) in the workspace."""
        query = select(Label).where(
            Label.workspace_id == workspace_id,
            func.lower(Label.name) == name.lower(),
        )
        return (await self._session.execute(query)).scalars().first()
