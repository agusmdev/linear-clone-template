"""Team and workflow state repositories - database access layer."""

import uuid

from sqlalchemy import select

from app.modules.teams.models import Team, WorkflowState
from app.repositories.sql_repository import SQLAlchemyRepository


class TeamRepository(SQLAlchemyRepository[Team]):
    model = Team

    async def list_for_workspace(self, workspace_id: uuid.UUID) -> list[Team]:
        query = (
            select(Team)
            .where(Team.workspace_id == workspace_id)
            .order_by(Team.name, Team.id)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_by_key(self, workspace_id: uuid.UUID, key: str) -> Team | None:
        query = select(Team).where(Team.workspace_id == workspace_id, Team.key == key)
        return (await self._session.execute(query)).scalar_one_or_none()


class WorkflowStateRepository(SQLAlchemyRepository[WorkflowState]):
    model = WorkflowState

    async def list_for_team(self, team_id: uuid.UUID) -> list[WorkflowState]:
        query = (
            select(WorkflowState)
            .where(WorkflowState.team_id == team_id)
            .order_by(WorkflowState.position, WorkflowState.created_at)
        )
        return list((await self._session.execute(query)).scalars().all())
