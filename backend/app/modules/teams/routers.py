"""Teams router: teams of a workspace, workflow states of a team."""

import uuid

from fastapi import APIRouter, Depends, status

from app.core.logging import log_action, log_entity
from app.modules.teams.dependencies import get_team_service
from app.modules.teams.schemas import TeamResponse, WorkflowStateResponse
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
