"""Team, team member and workflow state repositories - database access layer."""

import uuid
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.orm import selectinload

from app.modules.issues.models import Issue, IssueActivity, IssueActivityAction
from app.modules.teams.models import (
    Team,
    TeamMember,
    WorkflowState,
    WorkflowStateType,
)
from app.repositories.sql_repository import SQLAlchemyRepository


class TeamRepository(SQLAlchemyRepository[Team]):
    model = Team

    async def list_for_workspace(
        self, workspace_id: uuid.UUID, *, member_id: uuid.UUID | None = None
    ) -> list[Team]:
        """The workspace's teams by name; with ``member_id`` only the user's teams."""
        query = (
            select(Team)
            .where(Team.workspace_id == workspace_id)
            .order_by(Team.name, Team.id)
        )
        if member_id is not None:
            query = query.join(
                TeamMember,
                (TeamMember.team_id == Team.id) & (TeamMember.user_id == member_id),
            )
        return list((await self._session.execute(query)).scalars().all())

    async def get_by_key(self, workspace_id: uuid.UUID, key: str) -> Team | None:
        query = select(Team).where(Team.workspace_id == workspace_id, Team.key == key)
        return (await self._session.execute(query)).scalar_one_or_none()

    async def count_for_workspace(self, workspace_id: uuid.UUID) -> int:
        query = select(func.count()).where(Team.workspace_id == workspace_id)
        return int((await self._session.execute(query)).scalar_one())

    @SQLAlchemyRepository.translate_commit_errors
    async def create_with_states(
        self,
        *,
        team: dict[str, Any],
        creator_id: uuid.UUID,
        states: list[dict[str, Any]],
    ) -> Team:
        """Insert a team, its creator as member and its workflow states in one commit."""
        created = (
            await self._session.execute(insert(Team).values(**team).returning(Team))
        ).scalar_one()
        await self._session.execute(
            insert(TeamMember).values(team_id=created.id, user_id=creator_id)
        )
        await self._session.execute(
            insert(WorkflowState), [{**s, "team_id": created.id} for s in states]
        )
        await self._session.commit()
        return created

    @SQLAlchemyRepository.translate_commit_errors
    async def delete_team(self, team_id: uuid.UUID) -> None:
        """Delete a team with its issues (first: their state key is RESTRICT)."""
        await self._session.execute(delete(Issue).where(Issue.team_id == team_id))
        await self._session.execute(delete(Team).where(Team.id == team_id))
        await self._session.commit()


class TeamMemberRepository(SQLAlchemyRepository[TeamMember]):
    model = TeamMember

    async def list_with_users(self, team_id: uuid.UUID) -> list[TeamMember]:
        query = (
            select(TeamMember)
            .where(TeamMember.team_id == team_id)
            .options(selectinload(TeamMember.user))
            .order_by(TeamMember.created_at, TeamMember.id)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_membership(
        self, team_id: uuid.UUID, user_id: uuid.UUID
    ) -> TeamMember | None:
        query = (
            select(TeamMember)
            .where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
            .options(selectinload(TeamMember.user))
            .execution_options(populate_existing=True)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    @SQLAlchemyRepository.translate_commit_errors
    async def add_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self._session.execute(
            insert(TeamMember).values(team_id=team_id, user_id=user_id)
        )
        await self._session.commit()


class WorkflowStateRepository(SQLAlchemyRepository[WorkflowState]):
    model = WorkflowState

    async def list_for_team(self, team_id: uuid.UUID) -> list[WorkflowState]:
        query = (
            select(WorkflowState)
            .where(WorkflowState.team_id == team_id)
            .order_by(WorkflowState.position, WorkflowState.created_at)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def next_position(self, team_id: uuid.UUID) -> float:
        query = select(func.max(WorkflowState.position)).where(
            WorkflowState.team_id == team_id
        )
        last = (await self._session.execute(query)).scalar_one_or_none()
        return 0.0 if last is None else float(last) + 1

    async def get_by_name(self, team_id: uuid.UUID, name: str) -> WorkflowState | None:
        """The state named ``name`` (any case, outer spaces ignored) in the team."""
        query = select(WorkflowState).where(
            WorkflowState.team_id == team_id,
            func.lower(func.trim(WorkflowState.name)) == name.strip().lower(),
        )
        return (await self._session.execute(query)).scalars().first()

    async def count_issues(self, state_id: uuid.UUID) -> int:
        query = select(func.count()).where(Issue.state_id == state_id)
        return int((await self._session.execute(query)).scalar_one())

    @SQLAlchemyRepository.translate_commit_errors
    async def delete_state(
        self,
        state: WorkflowState,
        *,
        actor_id: uuid.UUID,
        move_to: WorkflowState | None = None,
    ) -> None:
        """Move the state's issues to ``move_to`` (if given), then delete the state.

        The moved issues get the started/completed/canceled timestamps of the
        new state's type and a status history row, as a status change through
        PATCH /issues would. One commit.
        """
        state_id = state.id
        if move_to is not None:
            now = func.now()
            values: dict[str, Any] = {"state_id": move_to.id}
            if move_to.type in (WorkflowStateType.backlog, WorkflowStateType.unstarted):
                values |= {
                    "started_at": None,
                    "completed_at": None,
                    "canceled_at": None,
                }
            elif move_to.type == WorkflowStateType.started:
                values |= {
                    "started_at": func.coalesce(Issue.started_at, now),
                    "completed_at": None,
                    "canceled_at": None,
                }
            elif move_to.type == WorkflowStateType.completed:
                values |= {
                    "completed_at": func.coalesce(Issue.completed_at, now),
                    "canceled_at": None,
                }
            else:
                values |= {
                    "canceled_at": func.coalesce(Issue.canceled_at, now),
                    "completed_at": None,
                }
            result = await self._session.execute(
                update(Issue)
                .where(Issue.state_id == state_id)
                .values(**values)
                .returning(Issue.id)
            )
            moved_ids = list(result.scalars().all())
            if moved_ids:
                await self._session.execute(
                    insert(IssueActivity),
                    [
                        {
                            "issue_id": issue_id,
                            "actor_id": actor_id,
                            "action": IssueActivityAction.updated,
                            "field": "state",
                            "from_value": state.name,
                            "to_value": move_to.name,
                        }
                        for issue_id in moved_ids
                    ],
                )
        await self._session.execute(
            delete(WorkflowState).where(WorkflowState.id == state_id)
        )
        await self._session.commit()
