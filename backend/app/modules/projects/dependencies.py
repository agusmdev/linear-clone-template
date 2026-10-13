"""Dependency factory functions for the Project module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.projects.repository import ProjectRepository
from app.modules.projects.service import ProjectService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_project_service(
    repo: ProjectRepository = Depends(get_repository(ProjectRepository)),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> ProjectService:
    return ProjectService(repo=repo, workspace_service=workspace_service)
