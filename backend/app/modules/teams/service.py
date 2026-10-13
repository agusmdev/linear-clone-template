"""Team service - business logic layer (teams and their workflow states)."""

import uuid

from app.modules.teams.models import Team, WorkflowState, WorkflowStateType
from app.modules.teams.repository import TeamRepository, WorkflowStateRepository
from app.modules.workspaces.service import WorkspaceService
from app.repositories.exceptions import NotFoundError
from app.services.base_crud_service import BaseService


class TeamService(BaseService[Team]):
    def __init__(
        self,
        repo: TeamRepository,
        state_repo: WorkflowStateRepository,
        workspace_service: WorkspaceService,
    ) -> None:
        self.repo = repo
        self.state_repo = state_repo
        self.workspace_service = workspace_service

    async def get_for_member(self, team_id: uuid.UUID, *, user_id: uuid.UUID) -> Team:
        """Return the team if the user is a member of its workspace, else 404."""
        team = await self.repo.get(team_id, raise_error=False)
        if team is None:
            raise NotFoundError(detail=f"Team {team_id} not found")
        try:
            await self.workspace_service.require_member(team.workspace_id, user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=f"Team {team_id} not found") from err
        self._log_entity(team.id)
        return team

    async def list_teams(
        self, workspace_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[Team]:
        await self.workspace_service.require_member(workspace_id, user_id)
        return await self.repo.list_for_workspace(workspace_id)

    async def get_by_key(self, workspace_id: uuid.UUID, key: str) -> Team | None:
        """The team with ``key`` in the workspace (no member check: callers do it)."""
        return await self.repo.get_by_key(workspace_id, key.upper())

    async def list_states(
        self, team_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[WorkflowState]:
        await self.get_for_member(team_id, user_id=user_id)
        return await self.state_repo.list_for_team(team_id)

    async def get_state(self, state_id: uuid.UUID) -> WorkflowState | None:
        return await self.state_repo.get(state_id, raise_error=False)

    async def default_state(self, team_id: uuid.UUID) -> WorkflowState:
        """The state of a new issue: the first "unstarted" state (Todo), else the first."""
        states = await self.state_repo.list_for_team(team_id)
        for state in states:
            if state.type == WorkflowStateType.unstarted:
                return state
        if not states:
            raise NotFoundError(detail=f"Team {team_id} has no workflow states")
        return states[0]
