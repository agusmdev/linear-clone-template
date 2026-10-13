"""Dependency factory functions for the Favorite module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.favorites.repository import FavoriteRepository
from app.modules.favorites.service import FavoriteService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_favorite_service(
    repo: FavoriteRepository = Depends(get_repository(FavoriteRepository)),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> FavoriteService:
    return FavoriteService(repo=repo, workspace_service=workspace_service)
