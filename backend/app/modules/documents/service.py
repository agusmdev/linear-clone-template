"""Document service - business logic layer.

Every method checks that the user is a member of the document's workspace (a
non-member gets the 404 of a missing document). A project or team must be in
the same workspace (else 400 ``invalid_reference``). Every update sets
``last_edited_by_id`` to the current user.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi_pagination import Page, Params

from app.modules.documents.filters import DocumentFilter
from app.modules.documents.models import Document
from app.modules.documents.repository import DocumentRepository
from app.modules.documents.schemas import DocumentCreate, DocumentUpdate
from app.modules.workspaces.exceptions import InvalidReferenceError
from app.modules.workspaces.service import WorkspaceService
from app.repositories.base_repository import QueryOptions
from app.repositories.exceptions import NotFoundError
from app.services.base_crud_service import BaseService


class DocumentService(BaseService[Document]):
    def __init__(
        self, repo: DocumentRepository, workspace_service: WorkspaceService
    ) -> None:
        self.repo = repo
        self.workspace_service = workspace_service

    async def get_for_member(
        self, document_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> Document:
        document = await self.repo.get_full(document_id)
        detail = f"Document {document_id} not found"
        if document is None:
            raise NotFoundError(detail=detail)
        try:
            await self.workspace_service.require_member(document.workspace_id, user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        self._log_entity(document.id)
        return document

    async def list_documents(
        self,
        workspace_id: uuid.UUID,
        pagination_params: Params,
        document_filter: DocumentFilter,
        *,
        user_id: uuid.UUID,
    ) -> Page[Document]:
        await self.workspace_service.require_member(workspace_id, user_id)
        base_query = self.repo.select_full().where(
            Document.workspace_id == workspace_id
        )
        return await self.repo.get_all_paginated(
            pagination_params, document_filter, QueryOptions(base_query=base_query)
        )

    async def _check_references(
        self,
        workspace_id: uuid.UUID,
        project_id: uuid.UUID | None,
        team_id: uuid.UUID | None,
    ) -> None:
        if project_id is not None:
            project = await self.repo.get_project(project_id)
            if project is None or project.workspace_id != workspace_id:
                raise InvalidReferenceError(
                    detail=f"Project {project_id} is not in this workspace"
                )
        if team_id is not None:
            team = await self.repo.get_team(team_id)
            if team is None or team.workspace_id != workspace_id:
                raise InvalidReferenceError(
                    detail=f"Team {team_id} is not in this workspace"
                )

    async def create_document(
        self, data: DocumentCreate, *, user_id: uuid.UUID
    ) -> Document:
        await self.workspace_service.require_member(data.workspace_id, user_id)
        await self._check_references(data.workspace_id, data.project_id, data.team_id)
        values: dict[str, Any] = {
            **data.model_dump(),
            "creator_id": user_id,
            "last_edited_by_id": user_id,
            "sort_order": await self.repo.next_sort_order(data.workspace_id),
        }
        document = await self.repo.create_document(values)
        self._log_entity(document.id)
        return document

    async def update_document(
        self, document_id: uuid.UUID, data: DocumentUpdate, *, user_id: uuid.UUID
    ) -> Document:
        document = await self.get_for_member(document_id, user_id=user_id)
        changes = data.model_dump(exclude_unset=True)
        await self._check_references(
            document.workspace_id,
            changes.get("project_id"),
            changes.get("team_id"),
        )
        values: dict[str, Any] = {
            **changes,
            "last_edited_by_id": user_id,
            "updated_at": datetime.now(tz=UTC),
        }
        updated = await self.repo.update_document(document.id, values)
        self._log_entity(document.id)
        return updated

    async def delete_document(
        self, document_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        await self.get_for_member(document_id, user_id=user_id)
        await self.repo.delete(document_id)
        self._log_entity(document_id)
