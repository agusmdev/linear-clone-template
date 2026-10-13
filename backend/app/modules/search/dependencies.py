"""Dependency factory functions for the Search module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.search.repository import SearchRepository
from app.modules.search.service import SearchService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_search_service(
    repo: SearchRepository = Depends(get_repository(SearchRepository)),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> SearchService:
    return SearchService(repo=repo, workspace_service=workspace_service)
