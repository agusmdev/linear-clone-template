"""Label service - business logic layer."""

import uuid

from app.modules.labels.models import Label
from app.modules.labels.repository import LabelRepository
from app.modules.workspaces.service import WorkspaceService
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
