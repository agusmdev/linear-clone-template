"""Project repository - database access layer."""

import uuid
from typing import Any

from sqlalchemy import case, delete, func, insert, select, update

from app.modules.issues.models import Issue
from app.modules.projects.models import Project, ProjectStatus, ProjectTeam
from app.modules.teams.models import Team, WorkflowState, WorkflowStateType
from app.repositories.exceptions import NotFoundError
from app.repositories.sql_repository import SQLAlchemyRepository
from app.user.models import User


class ProjectRepository(SQLAlchemyRepository[Project]):
    model = Project

    async def get_fresh(self, project_id: uuid.UUID) -> Project | None:
        query = (
            select(Project)
            .where(Project.id == project_id)
            .execution_options(populate_existing=True)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def list_for_workspace(
        self,
        workspace_id: uuid.UUID,
        *,
        status: ProjectStatus | None = None,
        team_id: uuid.UUID | None = None,
    ) -> list[Project]:
        query = select(Project).where(Project.workspace_id == workspace_id)
        if status is not None:
            query = query.where(Project.status == status)
        if team_id is not None:
            query = query.where(
                Project.id.in_(
                    select(ProjectTeam.project_id).where(ProjectTeam.team_id == team_id)
                )
            )
        query = query.order_by(Project.sort_order, Project.created_at, Project.id)
        return list((await self._session.execute(query)).scalars().all())

    async def teams_by_project(
        self, project_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, list[Team]]:
        result: dict[uuid.UUID, list[Team]] = {pid: [] for pid in project_ids}
        if not project_ids:
            return result
        query = (
            select(ProjectTeam.project_id, Team)
            .join(Team, Team.id == ProjectTeam.team_id)
            .where(ProjectTeam.project_id.in_(project_ids))
            .order_by(Team.name, Team.id)
        )
        for project_id, team in (await self._session.execute(query)).all():
            result[project_id].append(team)
        return result

    async def issue_counts(
        self, project_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[int, int]]:
        """``{project_id: (total, completed)}``; canceled and archived issues left out."""
        result: dict[uuid.UUID, tuple[int, int]] = dict.fromkeys(project_ids, (0, 0))
        if not project_ids:
            return result
        completed = func.sum(
            case((WorkflowState.type == WorkflowStateType.completed, 1), else_=0)
        )
        query = (
            select(Issue.project_id, func.count(Issue.id), completed)
            .join(WorkflowState, WorkflowState.id == Issue.state_id)
            .where(
                Issue.project_id.in_(project_ids),
                Issue.archived_at.is_(None),
                WorkflowState.type != WorkflowStateType.canceled,
            )
            .group_by(Issue.project_id)
        )
        for project_id, total, done in (await self._session.execute(query)).all():
            result[project_id] = (int(total), int(done or 0))
        return result

    async def users_by_ids(self, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
        if not user_ids:
            return {}
        query = select(User).where(User.id.in_(user_ids))
        return {u.id: u for u in (await self._session.execute(query)).scalars().all()}

    async def teams_by_ids(self, team_ids: set[uuid.UUID]) -> list[Team]:
        if not team_ids:
            return []
        query = select(Team).where(Team.id.in_(team_ids))
        return list((await self._session.execute(query)).scalars().all())

    async def next_sort_order(self, workspace_id: uuid.UUID) -> float:
        query = select(func.max(Project.sort_order)).where(
            Project.workspace_id == workspace_id
        )
        current = (await self._session.execute(query)).scalar_one_or_none()
        return (current or 0.0) + 1.0

    async def _set_teams(self, project_id: uuid.UUID, team_ids: set[uuid.UUID]) -> None:
        await self._session.execute(
            delete(ProjectTeam).where(ProjectTeam.project_id == project_id)
        )
        if team_ids:
            await self._session.execute(
                insert(ProjectTeam),
                [{"project_id": project_id, "team_id": tid} for tid in team_ids],
            )

    async def _get_or_404(self, project_id: uuid.UUID) -> Project:
        project = await self.get_fresh(project_id)
        if project is None:
            raise NotFoundError(detail=f"Project {project_id} not found")
        return project

    @SQLAlchemyRepository.translate_commit_errors
    async def create_project(
        self, values: dict[str, Any], *, team_ids: set[uuid.UUID]
    ) -> Project:
        """Insert the project and its teams in one commit."""
        project_id = (
            await self._session.execute(
                insert(Project).values(**values).returning(Project.id)
            )
        ).scalar_one()
        await self._set_teams(project_id, team_ids)
        await self._session.commit()
        return await self._get_or_404(project_id)

    @SQLAlchemyRepository.translate_commit_errors
    async def update_project(
        self,
        project_id: uuid.UUID,
        values: dict[str, Any],
        *,
        team_ids: set[uuid.UUID] | None,
    ) -> Project:
        """Update columns and replace the teams (when given) in one commit."""
        if values:
            await self._session.execute(
                update(Project).where(Project.id == project_id).values(**values)
            )
        if team_ids is not None:
            await self._set_teams(project_id, team_ids)
        await self._session.commit()
        return await self._get_or_404(project_id)
