"""Favorites router: my sidebar favorites (issues, projects, documents, teams)."""

import uuid

from fastapi import APIRouter, Depends, status

from app.core.logging import log_action, log_entity
from app.modules.favorites.dependencies import get_favorite_service
from app.modules.favorites.schemas import (
    FavoriteCreate,
    FavoriteResponse,
    FavoriteUpdate,
)
from app.modules.favorites.service import FavoriteService
from app.user.auth import require_current_user_id

favorites_router = APIRouter(
    tags=["favorites"],
    dependencies=[Depends(require_current_user_id)],
)


@favorites_router.get(
    "/workspaces/{workspace_id}/favorites",
    response_description="List my favorites in a workspace",
    status_code=status.HTTP_200_OK,
)
async def list_favorites(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    favorite_service: FavoriteService = Depends(get_favorite_service),
) -> list[FavoriteResponse]:
    log_action("list")
    log_entity("workspace", workspace_id)
    result = await favorite_service.list_favorites(workspace_id, user_id=user_id)
    return [FavoriteResponse.model_validate(f) for f in result]


@favorites_router.post(
    "/favorites",
    response_description="Add a favorite",
    status_code=status.HTTP_201_CREATED,
)
async def add_favorite(
    data: FavoriteCreate,
    user_id: uuid.UUID = Depends(require_current_user_id),
    favorite_service: FavoriteService = Depends(get_favorite_service),
) -> FavoriteResponse:
    log_action("create")
    result = await favorite_service.add_favorite(data, user_id=user_id)
    return FavoriteResponse.model_validate(result)


@favorites_router.patch(
    "/favorites/{favorite_id}",
    response_description="Move a favorite (sort order)",
    status_code=status.HTTP_200_OK,
)
async def update_favorite(
    favorite_id: uuid.UUID,
    data: FavoriteUpdate,
    user_id: uuid.UUID = Depends(require_current_user_id),
    favorite_service: FavoriteService = Depends(get_favorite_service),
) -> FavoriteResponse:
    log_action("update")
    log_entity("favorite", favorite_id)
    result = await favorite_service.update_favorite(favorite_id, data, user_id=user_id)
    return FavoriteResponse.model_validate(result)


@favorites_router.delete(
    "/favorites/{favorite_id}",
    response_description="Remove a favorite",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_favorite(
    favorite_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    favorite_service: FavoriteService = Depends(get_favorite_service),
) -> None:
    log_action("delete")
    log_entity("favorite", favorite_id)
    await favorite_service.delete_favorite(favorite_id, user_id=user_id)
