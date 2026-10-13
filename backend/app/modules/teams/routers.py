"""Teams router: teams of a workspace, team members, workflow states of a team."""

import uuid
from typing import Literal

from fastapi import APIRouter, Body, Depends, Query, status

from app.core.logging import log_action, log_entity
from app.modules.teams.dependencies import get_team_service
from app.modules.teams.schemas import (
    TeamCreate,
    TeamMemberAdd,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdate,
    WorkflowStateCreate,
    WorkflowStateResponse,
    WorkflowStateUpdate,
)
from app.modules.teams.service import TeamService
from app.user.auth import require_current_user_id

teams_router = APIRouter(
    tags=["teams"],
    dependencies=[Depends(require_current_user_id)],
)


@teams_router.get(
    "/workspaces/{workspace_id}/teams",
    response_description="List the teams of a workspace",
    status_code=status.HTTP_200_OK,
)
async def list_teams(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> list[TeamResponse]:
    log_action("list")
    log_entity("workspace", workspace_id)
    result = await team_service.list_teams(workspace_id, user_id=user_id)
    return [TeamResponse.model_validate(t) for t in result]


@teams_router.post(
    "/workspaces/{workspace_id}/teams",
    response_description="Create a team with the default workflow states",
    status_code=status.HTTP_201_CREATED,
)
async def create_team(
    workspace_id: uuid.UUID,
    team: TeamCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    log_action("create")
    log_entity("workspace", workspace_id)
    result = await team_service.create_team(workspace_id, team, user_id=user_id)
    return TeamResponse.model_validate(result)


@teams_router.get(
    "/teams/{team_id}",
    response_description="Get a team",
    status_code=status.HTTP_200_OK,
)
async def get_team(
    team_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    log_action("get")
    result = await team_service.get_for_member(team_id, user_id=user_id)
    return TeamResponse.model_validate(result)


@teams_router.patch(
    "/teams/{team_id}",
    response_description="Update a team (team members and admins)",
    status_code=status.HTTP_200_OK,
)
async def update_team(
    team_id: uuid.UUID,
    team: TeamUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    log_action("update")
    log_entity("team", team_id)
    result = await team_service.update_team(team_id, team, user_id=user_id)
    return TeamResponse.model_validate(result)


@teams_router.delete(
    "/teams/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete a team and its issues (admins)",
)
async def delete_team(
    team_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> None:
    log_action("delete")
    log_entity("team", team_id)
    await team_service.delete_team(team_id, user_id=user_id)


@teams_router.get(
    "/teams/{team_id}/members",
    response_description="List the members of a team",
    status_code=status.HTTP_200_OK,
)
async def list_team_members(
    team_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> list[TeamMemberResponse]:
    log_action("list_members")
    result = await team_service.list_members(team_id, user_id=user_id)
    return [TeamMemberResponse.model_validate(m) for m in result]


@teams_router.post(
    "/teams/{team_id}/members",
    response_description="Join a team, or add a workspace member to it",
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: uuid.UUID,
    member: TeamMemberAdd | None = Body(None),
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> TeamMemberResponse:
    log_action("add_member")
    log_entity("team", team_id)
    result = await team_service.add_member(
        team_id, member or TeamMemberAdd(), user_id=user_id
    )
    return TeamMemberResponse.model_validate(result)


@teams_router.delete(
    "/teams/{team_id}/members/{member_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Leave a team (`me`), or remove a member from it",
)
async def remove_team_member(
    team_id: uuid.UUID,
    member_user_id: uuid.UUID | Literal["me"],
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> None:
    log_action("remove_member")
    log_entity("team", team_id)
    target = user_id if member_user_id == "me" else uuid.UUID(str(member_user_id))
    await team_service.remove_member(team_id, target, user_id=user_id)


@teams_router.get(
    "/teams/{team_id}/states",
    response_description="List the workflow states of a team, in board order",
    status_code=status.HTTP_200_OK,
)
async def list_team_states(
    team_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> list[WorkflowStateResponse]:
    log_action("list_states")
    result = await team_service.list_states(team_id, user_id=user_id)
    return [WorkflowStateResponse.model_validate(s) for s in result]


@teams_router.post(
    "/teams/{team_id}/states",
    response_description="Add a workflow state to a team",
    status_code=status.HTTP_201_CREATED,
)
async def create_team_state(
    team_id: uuid.UUID,
    state: WorkflowStateCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> WorkflowStateResponse:
    log_action("create_state")
    log_entity("team", team_id)
    result = await team_service.create_state(team_id, state, user_id=user_id)
    log_entity("workflow_state", result.id)
    return WorkflowStateResponse.model_validate(result)


@teams_router.patch(
    "/workflow-states/{state_id}",
    response_description="Rename, recolor, retype or move a workflow state",
    status_code=status.HTTP_200_OK,
)
async def update_workflow_state(
    state_id: uuid.UUID,
    state: WorkflowStateUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> WorkflowStateResponse:
    log_action("update_state")
    log_entity("workflow_state", state_id)
    result = await team_service.update_state(state_id, state, user_id=user_id)
    return WorkflowStateResponse.model_validate(result)


@teams_router.delete(
    "/workflow-states/{state_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete a workflow state (its issues can move first)",
)
async def delete_workflow_state(
    state_id: uuid.UUID,
    move_to_state_id: uuid.UUID | None = Query(None),
    user_id: uuid.UUID = Depends(require_current_user_id),
    team_service: TeamService = Depends(get_team_service),
) -> None:
    log_action("delete_state")
    log_entity("workflow_state", state_id)
    await team_service.delete_state(
        state_id, move_to_state_id=move_to_state_id, user_id=user_id
    )
