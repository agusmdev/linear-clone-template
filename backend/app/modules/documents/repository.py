"""Document repository - database access layer."""

import uuid
from typing import Any

from sqlalchemy import func, insert, select, update
from sqlalchemy.orm import selectinload

from app.modules.documents.models import Document
from app.modules.projects.models import Project
from app.modules.teams.models import Team
from app.repositories.exceptions import NotFoundError
from app.repositories.sql_repository import SQLAlchemyRepository

# The relationships DocumentResponse embeds.
LOAD_OPTIONS = (
    selectinload(Document.creator),
    selectinload(Document.last_edited_by),
    selectinload(Document.project),
)


class DocumentRepository(SQLAlchemyRepository[Document]):
    model = Document

    def select_full(self) -> Any:
        """``SELECT document`` with the embedded relationships loaded."""
        return select(Document).options(*LOAD_OPTIONS)

    async def get_full(self, document_id: uuid.UUID) -> Document | None:
        query = (
            self.select_full()
            .where(Document.id == document_id)
            .execution_options(populate_existing=True)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def _get_full_or_404(self, document_id: uuid.UUID) -> Document:
        document = await self.get_full(document_id)
        if document is None:
            raise NotFoundError(detail=f"Document {document_id} not found")
        return document

    async def next_sort_order(self, workspace_id: uuid.UUID) -> float:
        query = select(func.max(Document.sort_order)).where(
            Document.workspace_id == workspace_id
        )
        current = (await self._session.execute(query)).scalar_one_or_none()
        return (current or 0.0) + 1.0

    async def get_project(self, project_id: uuid.UUID) -> Project | None:
        return await self._session.get(Project, project_id)

    async def get_team(self, team_id: uuid.UUID) -> Team | None:
        return await self._session.get(Team, team_id)

    @SQLAlchemyRepository.translate_commit_errors
    async def create_document(self, values: dict[str, Any]) -> Document:
        document_id = (
            await self._session.execute(
                insert(Document).values(**values).returning(Document.id)
            )
        ).scalar_one()
        await self._session.commit()
        return await self._get_full_or_404(document_id)

    @SQLAlchemyRepository.translate_commit_errors
    async def update_document(
        self, document_id: uuid.UUID, values: dict[str, Any]
    ) -> Document:
        await self._session.execute(
            update(Document).where(Document.id == document_id).values(**values)
        )
        await self._session.commit()
        return await self._get_full_or_404(document_id)
