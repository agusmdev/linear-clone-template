"""Dependency factory functions for the Team module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.teams.repository import TeamRepository, WorkflowStateRepository
from app.modules.teams.service import TeamService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_team_service(
    repo: TeamRepository = Depends(get_repository(TeamRepository)),
    state_repo: WorkflowStateRepository = Depends(
        get_repository(WorkflowStateRepository)
    ),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> TeamService:
    return TeamService(
        repo=repo, state_repo=state_repo, workspace_service=workspace_service
    )
