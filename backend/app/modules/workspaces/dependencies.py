"""Dependency factory functions for the Workspace module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.workspaces.repository import (
    WorkspaceMemberRepository,
    WorkspaceRepository,
)
from app.modules.workspaces.service import WorkspaceService


def get_workspace_service(
    repo: WorkspaceRepository = Depends(get_repository(WorkspaceRepository)),
    member_repo: WorkspaceMemberRepository = Depends(
        get_repository(WorkspaceMemberRepository)
    ),
) -> WorkspaceService:
    return WorkspaceService(repo=repo, member_repo=member_repo)
