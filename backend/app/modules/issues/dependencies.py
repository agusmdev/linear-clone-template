"""Dependency factory functions for the Issue module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.issues.repository import IssueRepository
from app.modules.issues.service import IssueService
from app.modules.labels.dependencies import get_label_service
from app.modules.labels.service import LabelService
from app.modules.teams.dependencies import get_team_service
from app.modules.teams.service import TeamService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_issue_service(
    repo: IssueRepository = Depends(get_repository(IssueRepository)),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
    team_service: TeamService = Depends(get_team_service),
    label_service: LabelService = Depends(get_label_service),
) -> IssueService:
    return IssueService(
        repo=repo,
        workspace_service=workspace_service,
        team_service=team_service,
        label_service=label_service,
    )
