"""Label service - business logic layer.

Any member of the workspace can create, change and delete its labels.
"""

import uuid

from app.modules.labels.models import Label
from app.modules.labels.repository import LabelRepository
from app.modules.labels.schemas import LabelCreate, LabelUpdate
from app.modules.workspaces.service import WorkspaceService
from app.repositories.exceptions import DuplicateError, NotFoundError
from app.services.base_crud_service import BaseService


class LabelService(BaseService[Label]):
    def __init__(
        self, repo: LabelRepository, workspace_service: WorkspaceService
    ) -> None:
        self.repo = repo
        self.workspace_service = workspace_service

    async def list_labels(
        self, workspace_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[Label]:
        await self.workspace_service.require_member(workspace_id, user_id)
        return await self.repo.list_for_workspace(workspace_id)

    async def labels_of_workspace(
        self, workspace_id: uuid.UUID, label_ids: set[uuid.UUID]
    ) -> list[Label] | None:
        """The labels with these ids, or None if any is missing or in another workspace."""
        labels = await self.repo.list_by_ids(label_ids)
        if len(labels) != len(label_ids) or any(
            label.workspace_id != workspace_id for label in labels
        ):
            return None
        return labels

    async def _get_for_member(self, label_id: uuid.UUID, user_id: uuid.UUID) -> Label:
        label = await self.repo.get(label_id, raise_error=False)
        detail = f"Label {label_id} not found"
        if label is None:
            raise NotFoundError(detail=detail)
        try:
            await self.workspace_service.require_member(label.workspace_id, user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        self._log_entity(label.id)
        return label

    async def _check_name_free(
        self, workspace_id: uuid.UUID, name: str, label_id: uuid.UUID | None = None
    ) -> None:
        taken = await self.repo.get_by_name(workspace_id, name)
        if taken is not None and taken.id != label_id:
            raise DuplicateError(detail=f"A label named '{name}' already exists")

    async def create_label(
        self, workspace_id: uuid.UUID, data: LabelCreate, *, user_id: uuid.UUID
    ) -> Label:
        await self.workspace_service.require_member(workspace_id, user_id)
        await self._check_name_free(workspace_id, data.name)
        return await self.create(data, workspace_id=workspace_id)

    async def update_label(
        self, label_id: uuid.UUID, data: LabelUpdate, *, user_id: uuid.UUID
    ) -> Label:
        label = await self._get_for_member(label_id, user_id)
        name = data.model_dump(exclude_unset=True).get("name")
        if name is not None:
            await self._check_name_free(label.workspace_id, name, label_id)
        return await self.update(label_id, data)

    async def delete_label(self, label_id: uuid.UUID, *, user_id: uuid.UUID) -> None:
        """Delete a label; the issues that had it lose it (cascade)."""
        await self._get_for_member(label_id, user_id)
        await self.delete(label_id)
