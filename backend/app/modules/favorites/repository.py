"""Favorite repository - database access layer."""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select

from app.modules.documents.models import Document
from app.modules.favorites.models import Favorite, FavoriteEntityType
from app.modules.issues.models import Issue
from app.modules.projects.models import Project
from app.modules.teams.models import Team
from app.repositories.sql_repository import SQLAlchemyRepository


@dataclass(frozen=True)
class EntityInfo:
    """What the sidebar shows for a favorite entity."""

    name: str
    identifier: str | None = None
    icon: str | None = None
    color: str | None = None


class FavoriteRepository(SQLAlchemyRepository[Favorite]):
    model = Favorite

    async def list_for_user(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[Favorite]:
        query = (
            select(Favorite)
            .where(Favorite.workspace_id == workspace_id, Favorite.user_id == user_id)
            .order_by(Favorite.sort_order, Favorite.created_at, Favorite.id)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_for_entity(
        self, user_id: uuid.UUID, entity_type: FavoriteEntityType, entity_id: uuid.UUID
    ) -> Favorite | None:
        query = select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.entity_type == entity_type,
            Favorite.entity_id == entity_id,
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def next_sort_order(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> float:
        query = select(func.max(Favorite.sort_order)).where(
            Favorite.workspace_id == workspace_id, Favorite.user_id == user_id
        )
        current = (await self._session.execute(query)).scalar_one_or_none()
        return 0.0 if current is None else current + 1

    async def entities(
        self,
        workspace_id: uuid.UUID,
        entity_type: FavoriteEntityType,
        entity_ids: set[uuid.UUID],
    ) -> dict[uuid.UUID, EntityInfo]:
        """The entities of the workspace with these ids (missing ids are left out)."""
        if not entity_ids:
            return {}
        result: dict[uuid.UUID, EntityInfo] = {}
        if entity_type == FavoriteEntityType.issue:
            issue_rows = await self._session.execute(
                select(Issue.id, Issue.number, Issue.title, Team.key)
                .join(Team, Team.id == Issue.team_id)
                .where(Issue.workspace_id == workspace_id, Issue.id.in_(entity_ids))
            )
            for issue_id, number, title, key in issue_rows.all():
                identifier = f"{key}-{number}"
                result[issue_id] = EntityInfo(
                    name=f"{identifier} {title}", identifier=identifier
                )
        elif entity_type == FavoriteEntityType.project:
            project_rows = await self._session.execute(
                select(Project.id, Project.name, Project.icon, Project.color).where(
                    Project.workspace_id == workspace_id, Project.id.in_(entity_ids)
                )
            )
            for project_id, name, icon, color in project_rows.all():
                result[project_id] = EntityInfo(name=name, icon=icon, color=color)
        elif entity_type == FavoriteEntityType.document:
            document_rows = await self._session.execute(
                select(Document.id, Document.title, Document.icon).where(
                    Document.workspace_id == workspace_id,
                    Document.id.in_(entity_ids),
                )
            )
            for document_id, title, icon in document_rows.all():
                result[document_id] = EntityInfo(name=title, icon=icon)
        else:
            team_rows = await self._session.execute(
                select(Team.id, Team.name, Team.key, Team.icon, Team.color).where(
                    Team.workspace_id == workspace_id, Team.id.in_(entity_ids)
                )
            )
            for team_id, name, key, icon, color in team_rows.all():
                result[team_id] = EntityInfo(
                    name=name, identifier=key, icon=icon, color=color
                )
        return result
