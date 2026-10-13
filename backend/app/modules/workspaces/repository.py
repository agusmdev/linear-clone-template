"""Workspace repositories - database access layer."""

import uuid
from typing import Any

from sqlalchemy import insert, select
from sqlalchemy.orm import selectinload

from app.modules.labels.models import Label
from app.modules.teams.models import Team, TeamMember, WorkflowState
from app.modules.workspaces.models import Workspace, WorkspaceMember, WorkspaceRole
from app.repositories.sql_repository import SQLAlchemyRepository


class WorkspaceRepository(SQLAlchemyRepository[Workspace]):
    model = Workspace

    @SQLAlchemyRepository.translate_commit_errors
    async def create_with_defaults(
        self,
        *,
        workspace: dict[str, Any],
        creator_id: uuid.UUID,
        team: dict[str, Any],
        states: list[dict[str, Any]],
        labels: list[dict[str, Any]],
    ) -> Workspace:
        """Insert a workspace, its admin, first team, states and labels in one commit."""
        created = (
            await self._session.execute(
                insert(Workspace)
                .values(**workspace, created_by_id=creator_id)
                .returning(Workspace)
            )
        ).scalar_one()
        await self._session.execute(
            insert(WorkspaceMember).values(
                workspace_id=created.id, user_id=creator_id, role=WorkspaceRole.admin
            )
        )
        team_id = (
            await self._session.execute(
                insert(Team).values(**team, workspace_id=created.id).returning(Team.id)
            )
        ).scalar_one()
        await self._session.execute(
            insert(TeamMember).values(team_id=team_id, user_id=creator_id)
        )
        await self._session.execute(
            insert(WorkflowState), [{**s, "team_id": team_id} for s in states]
        )
        await self._session.execute(
            insert(Label), [{**label, "workspace_id": created.id} for label in labels]
        )
        await self._session.commit()
        return created

    async def list_for_user(self, user_id: uuid.UUID) -> list[Workspace]:
        query = (
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user_id)
            .order_by(Workspace.name, Workspace.id)
        )
        return list((await self._session.execute(query)).scalars().all())


class WorkspaceMemberRepository(SQLAlchemyRepository[WorkspaceMember]):
    model = WorkspaceMember

    async def get_membership(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkspaceMember | None:
        query = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def count_members(
        self, workspace_id: uuid.UUID, user_ids: set[uuid.UUID]
    ) -> int:
        """How many of ``user_ids`` are members of the workspace."""
        if not user_ids:
            return 0
        query = select(WorkspaceMember.user_id).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id.in_(user_ids),
        )
        return len((await self._session.execute(query)).scalars().all())

    async def list_with_users(self, workspace_id: uuid.UUID) -> list[WorkspaceMember]:
        query = (
            select(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == workspace_id)
            .options(selectinload(WorkspaceMember.user))
            .order_by(WorkspaceMember.created_at, WorkspaceMember.id)
        )
        return list((await self._session.execute(query)).scalars().all())
