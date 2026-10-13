"""Workspace repositories - database access layer."""

import uuid
from typing import Any

from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import selectinload

from app.modules.issues.models import Issue
from app.modules.labels.models import Label
from app.modules.teams.models import Team, TeamMember, WorkflowState
from app.modules.workspaces.models import Workspace, WorkspaceMember, WorkspaceRole
from app.repositories.sql_repository import SQLAlchemyRepository
from app.user.models import User


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

    @SQLAlchemyRepository.translate_commit_errors
    async def delete_workspace(self, workspace_id: uuid.UUID) -> None:
        """Delete a workspace and everything in it, in one commit.

        Issues go first: their state foreign key is RESTRICT, so the cascade
        from the workspace through teams to states would refuse them.
        """
        await self._session.execute(
            delete(Issue).where(Issue.workspace_id == workspace_id)
        )
        await self._session.execute(
            delete(Workspace).where(Workspace.id == workspace_id)
        )
        await self._session.commit()


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

    async def get_with_user(self, member_id: uuid.UUID) -> WorkspaceMember | None:
        query = (
            select(WorkspaceMember)
            .where(WorkspaceMember.id == member_id)
            .options(selectinload(WorkspaceMember.user))
            .execution_options(populate_existing=True)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def count_admins(self, workspace_id: uuid.UUID) -> int:
        query = select(func.count()).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role == WorkspaceRole.admin,
        )
        return int((await self._session.execute(query)).scalar_one())

    async def get_user_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email, User.is_active.is_(True))
        return (await self._session.execute(query)).scalar_one_or_none()

    @SQLAlchemyRepository.translate_commit_errors
    async def add_member(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, role: WorkspaceRole
    ) -> WorkspaceMember:
        created = (
            await self._session.execute(
                insert(WorkspaceMember)
                .values(workspace_id=workspace_id, user_id=user_id, role=role)
                .returning(WorkspaceMember)
            )
        ).scalar_one()
        await self._session.commit()
        return created

    @SQLAlchemyRepository.translate_commit_errors
    async def remove_member(self, member: WorkspaceMember) -> None:
        """Delete the membership and the user's team memberships in the workspace."""
        team_ids = select(Team.id).where(Team.workspace_id == member.workspace_id)
        await self._session.execute(
            delete(TeamMember).where(
                TeamMember.user_id == member.user_id,
                TeamMember.team_id.in_(team_ids),
            )
        )
        await self._session.execute(
            delete(WorkspaceMember).where(WorkspaceMember.id == member.id)
        )
        await self._session.commit()
