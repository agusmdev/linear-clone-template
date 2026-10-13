"""Favorite service - business logic layer."""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime

from app.modules.favorites.models import Favorite, FavoriteEntityType
from app.modules.favorites.repository import EntityInfo, FavoriteRepository
from app.modules.favorites.schemas import FavoriteCreate, FavoriteUpdate
from app.modules.workspaces.exceptions import InvalidReferenceError
from app.modules.workspaces.service import WorkspaceService
from app.repositories.exceptions import DuplicateError, NotFoundError
from app.services.base_crud_service import BaseService


@dataclass(frozen=True)
class ResolvedFavorite:
    """A favorite with the display data of its entity (FavoriteResponse reads it)."""

    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    entity_type: FavoriteEntityType
    entity_id: uuid.UUID
    sort_order: float
    created_at: datetime
    name: str
    identifier: str | None
    icon: str | None
    color: str | None

    @classmethod
    def of(cls, favorite: Favorite, info: EntityInfo) -> "ResolvedFavorite":
        return cls(
            id=favorite.id,
            user_id=favorite.user_id,
            workspace_id=favorite.workspace_id,
            entity_type=favorite.entity_type,
            entity_id=favorite.entity_id,
            sort_order=favorite.sort_order,
            created_at=favorite.created_at,
            name=info.name,
            identifier=info.identifier,
            icon=info.icon,
            color=info.color,
        )


class FavoriteService(BaseService[Favorite]):
    def __init__(
        self, repo: FavoriteRepository, workspace_service: WorkspaceService
    ) -> None:
        self.repo = repo
        self.workspace_service = workspace_service

    async def list_favorites(
        self, workspace_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[ResolvedFavorite]:
        """My favorites in the workspace; rows whose entity is gone are deleted."""
        await self.workspace_service.require_member(workspace_id, user_id)
        favorites = await self.repo.list_for_user(workspace_id, user_id)
        ids_by_type: dict[FavoriteEntityType, set[uuid.UUID]] = defaultdict(set)
        for favorite in favorites:
            ids_by_type[favorite.entity_type].add(favorite.entity_id)
        infos: dict[tuple[FavoriteEntityType, uuid.UUID], EntityInfo] = {}
        for entity_type, ids in ids_by_type.items():
            found = await self.repo.entities(workspace_id, entity_type, ids)
            infos.update({(entity_type, k): v for k, v in found.items()})
        # A favorite whose entity was deleted is dropped (no FK to cascade).
        orphans = [f.id for f in favorites if (f.entity_type, f.entity_id) not in infos]
        await self.repo.delete_ids(orphans)
        return [
            ResolvedFavorite.of(f, infos[(f.entity_type, f.entity_id)])
            for f in favorites
            if (f.entity_type, f.entity_id) in infos
        ]

    async def _resolve(self, favorite: Favorite) -> ResolvedFavorite:
        found = await self.repo.entities(
            favorite.workspace_id, favorite.entity_type, {favorite.entity_id}
        )
        info = found.get(favorite.entity_id)
        if info is None:
            raise NotFoundError(detail=f"Favorite {favorite.id} not found")
        return ResolvedFavorite.of(favorite, info)

    async def _get_mine(self, favorite_id: uuid.UUID, user_id: uuid.UUID) -> Favorite:
        favorite = await self.repo.get(favorite_id, raise_error=False)
        if favorite is None or favorite.user_id != user_id:
            raise NotFoundError(detail=f"Favorite {favorite_id} not found")
        return favorite

    async def add_favorite(
        self, data: FavoriteCreate, *, user_id: uuid.UUID
    ) -> ResolvedFavorite:
        await self.workspace_service.require_member(data.workspace_id, user_id)
        found = await self.repo.entities(
            data.workspace_id, data.entity_type, {data.entity_id}
        )
        if data.entity_id not in found:
            raise InvalidReferenceError(
                detail=f"The {data.entity_type} does not exist in this workspace"
            )
        if await self.repo.get_for_entity(user_id, data.entity_type, data.entity_id):
            raise DuplicateError(
                detail=f"This {data.entity_type} is already a favorite"
            )
        sort_order = await self.repo.next_sort_order(data.workspace_id, user_id)
        favorite = await self.repo.create(data, user_id=user_id, sort_order=sort_order)
        self._log_entity(favorite.id)
        return ResolvedFavorite.of(favorite, found[data.entity_id])

    async def update_favorite(
        self, favorite_id: uuid.UUID, data: FavoriteUpdate, *, user_id: uuid.UUID
    ) -> ResolvedFavorite:
        await self._get_mine(favorite_id, user_id)
        favorite = await self.repo.update(favorite_id, data)
        return await self._resolve(favorite)

    async def delete_favorite(
        self, favorite_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        await self._get_mine(favorite_id, user_id)
        await self.repo.delete(favorite_id)
