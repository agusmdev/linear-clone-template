"""Team service - business logic layer (teams, team members, workflow states).

Access rules:
- Read (team, members, states): any member of the workspace.
- Join a team, leave a team: any member of the workspace.
- Create a team: any member of the workspace (the creator joins it).
- Change a team, its members and its workflow states: a member of the team or
  a workspace admin ("team manager").
- Delete a team: workspace admins only; the last team of a workspace stays.

Everyone else gets the 404 of a missing team (the API never answers 403).
"""

import uuid

from app.modules.teams.models import (
    Team,
    TeamMember,
    WorkflowState,
    WorkflowStateType,
)
from app.modules.teams.repository import (
    TeamMemberRepository,
    TeamRepository,
    WorkflowStateRepository,
)
from app.modules.teams.schemas import (
    TeamCreate,
    TeamMemberAdd,
    TeamUpdate,
    WorkflowStateCreate,
    WorkflowStateUpdate,
)
from app.modules.workspaces.exceptions import (
    InvalidReferenceError,
    LastStateError,
    LastTeamError,
)
from app.modules.workspaces.models import WorkspaceRole
from app.modules.workspaces.service import DEFAULT_STATES, WorkspaceService
from app.repositories.exceptions import (
    DuplicateError,
    NotFoundError,
    ReferencedError,
)
from app.services.base_crud_service import BaseService


class TeamService(BaseService[Team]):
    def __init__(
        self,
        repo: TeamRepository,
        state_repo: WorkflowStateRepository,
        workspace_service: WorkspaceService,
        member_repo: TeamMemberRepository,
    ) -> None:
        self.repo = repo
        self.state_repo = state_repo
        self.workspace_service = workspace_service
        self.member_repo = member_repo

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

    async def get_for_manager(self, team_id: uuid.UUID, *, user_id: uuid.UUID) -> Team:
        """Return the team if the user may change it (team member or admin), else 404."""
        team = await self.repo.get(team_id, raise_error=False)
        if team is None:
            raise NotFoundError(detail=f"Team {team_id} not found")
        try:
            membership = await self.workspace_service.require_member(
                team.workspace_id, user_id
            )
        except NotFoundError as err:
            raise NotFoundError(detail=f"Team {team_id} not found") from err
        if membership.role != WorkspaceRole.admin and (
            await self.member_repo.get_membership(team_id, user_id) is None
        ):
            raise NotFoundError(detail=f"Team {team_id} not found")
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

    # --- Teams -------------------------------------------------------------------

    async def _check_key_free(
        self, workspace_id: uuid.UUID, key: str, team_id: uuid.UUID | None = None
    ) -> None:
        taken = await self.repo.get_by_key(workspace_id, key)
        if taken is not None and taken.id != team_id:
            raise DuplicateError(detail=f"Team key '{key}' is already taken")

    async def create_team(
        self, workspace_id: uuid.UUID, data: TeamCreate, *, user_id: uuid.UUID
    ) -> Team:
        await self.workspace_service.require_member(workspace_id, user_id)
        await self._check_key_free(workspace_id, data.key)
        team = await self.repo.create_with_states(
            team={**data.model_dump(), "workspace_id": workspace_id},
            creator_id=user_id,
            states=[
                {"name": name, "type": state_type, "color": color, "position": i}
                for i, (name, state_type, color) in enumerate(DEFAULT_STATES)
            ],
        )
        self._log_entity(team.id)
        return team

    async def update_team(
        self, team_id: uuid.UUID, data: TeamUpdate, *, user_id: uuid.UUID
    ) -> Team:
        team = await self.get_for_manager(team_id, user_id=user_id)
        key = data.model_dump(exclude_unset=True).get("key")
        if key is not None:
            await self._check_key_free(team.workspace_id, key, team_id)
        return await self.update(team_id, data)

    async def delete_team(self, team_id: uuid.UUID, *, user_id: uuid.UUID) -> None:
        team = await self.repo.get(team_id, raise_error=False)
        if team is None:
            raise NotFoundError(detail=f"Team {team_id} not found")
        try:
            await self.workspace_service.require_admin(team.workspace_id, user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=f"Team {team_id} not found") from err
        if await self.repo.count_for_workspace(team.workspace_id) <= 1:
            raise LastTeamError()
        await self.repo.delete_team(team_id)
        self._log_entity(team_id)

    # --- Team members ------------------------------------------------------------

    async def list_members(
        self, team_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[TeamMember]:
        await self.get_for_member(team_id, user_id=user_id)
        return await self.member_repo.list_with_users(team_id)

    async def add_member(
        self, team_id: uuid.UUID, data: TeamMemberAdd, *, user_id: uuid.UUID
    ) -> TeamMember:
        """Join the team (no ``user_id``, or my own), or add a workspace member."""
        target = data.user_id or user_id
        if target == user_id:
            team = await self.get_for_member(team_id, user_id=user_id)
        else:
            team = await self.get_for_manager(team_id, user_id=user_id)
            if not await self.workspace_service.are_members(
                team.workspace_id, {target}
            ):
                raise InvalidReferenceError(
                    detail=f"User {target} is not a member of this workspace"
                )
        members = self.member_repo
        if await members.get_membership(team.id, target) is not None:
            raise DuplicateError(detail="The user is already a member of this team")
        await members.add_member(team.id, target)
        member = await members.get_membership(team.id, target)
        if member is None:  # pragma: no cover - the row was just inserted
            raise NotFoundError(detail="Team member not found")
        return member

    async def remove_member(
        self, team_id: uuid.UUID, member_user_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        """Leave the team (my own user id), or remove someone (team managers)."""
        if member_user_id == user_id:
            await self.get_for_member(team_id, user_id=user_id)
        else:
            await self.get_for_manager(team_id, user_id=user_id)
        members = self.member_repo
        member = await members.get_membership(team_id, member_user_id)
        if member is None:
            raise NotFoundError(detail="Team member not found")
        await members.delete(member.id)

    # --- Workflow states ---------------------------------------------------------

    async def list_states(
        self, team_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[WorkflowState]:
        await self.get_for_member(team_id, user_id=user_id)
        return await self.state_repo.list_for_team(team_id)

    async def get_state(self, state_id: uuid.UUID) -> WorkflowState | None:
        return await self.state_repo.get(state_id, raise_error=False)

    async def _state_for_manager(
        self, state_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> WorkflowState:
        state = await self.state_repo.get(state_id, raise_error=False)
        detail = f"Workflow state {state_id} not found"
        if state is None:
            raise NotFoundError(detail=detail)
        try:
            await self.get_for_manager(state.team_id, user_id=user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        return state

    async def create_state(
        self, team_id: uuid.UUID, data: WorkflowStateCreate, *, user_id: uuid.UUID
    ) -> WorkflowState:
        await self.get_for_manager(team_id, user_id=user_id)
        position = data.position
        if position is None:
            position = await self.state_repo.next_position(team_id)
        return await self.state_repo.create(data, team_id=team_id, position=position)

    async def update_state(
        self, state_id: uuid.UUID, data: WorkflowStateUpdate, *, user_id: uuid.UUID
    ) -> WorkflowState:
        await self._state_for_manager(state_id, user_id=user_id)
        return await self.state_repo.update(state_id, data)

    async def delete_state(
        self,
        state_id: uuid.UUID,
        *,
        move_to_state_id: uuid.UUID | None,
        user_id: uuid.UUID,
    ) -> None:
        """Delete a state. Its issues block it, unless ``move_to_state_id`` says
        where they go (a state of the same team)."""
        state = await self._state_for_manager(state_id, user_id=user_id)
        states = await self.state_repo.list_for_team(state.team_id)
        if len(states) <= 1:
            raise LastStateError()
        move_to: WorkflowState | None = None
        if move_to_state_id is not None:
            move_to = next(
                (s for s in states if s.id == move_to_state_id and s.id != state_id),
                None,
            )
            if move_to is None:
                raise InvalidReferenceError(
                    detail=f"Workflow state {move_to_state_id} is not another "
                    "state of this team"
                )
        elif await self.state_repo.count_issues(state_id) > 0:
            raise ReferencedError(
                detail="Issues use this workflow state: move them to another "
                "state first (move_to_state_id)"
            )
        await self.state_repo.delete_state(state_id, move_to=move_to)

    async def default_state(self, team_id: uuid.UUID) -> WorkflowState:
        """The state of a new issue: the first "unstarted" state (Todo), else the first."""
        states = await self.state_repo.list_for_team(team_id)
        for state in states:
            if state.type == WorkflowStateType.unstarted:
                return state
        if not states:
            raise NotFoundError(detail=f"Team {team_id} has no workflow states")
        return states[0]
