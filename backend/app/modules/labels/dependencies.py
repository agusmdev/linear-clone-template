"""Dependency factory functions for the Label module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.labels.repository import LabelRepository
from app.modules.labels.service import LabelService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_label_service(
    repo: LabelRepository = Depends(get_repository(LabelRepository)),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> LabelService:
    return LabelService(repo=repo, workspace_service=workspace_service)
