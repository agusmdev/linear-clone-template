"""Workspaces router: create, list mine, get by URL key, members."""

import uuid

from fastapi import APIRouter, Body, Depends, status

from app.core.logging import log_action, log_entity
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.schemas import (
    WorkspaceCreate,
    WorkspaceMemberResponse,
    WorkspaceResponse,
)
from app.modules.workspaces.service import WorkspaceService
from app.user.auth import require_current_user_id

workspaces_router = APIRouter(
    prefix="/workspaces",
    tags=["workspaces"],
    dependencies=[Depends(require_current_user_id)],
)


@workspaces_router.post(
    "",
    response_description="Create a workspace with its first team",
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace(
    workspace: WorkspaceCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> WorkspaceResponse:
    """Create a workspace. The creator becomes admin; a default team, workflow
    states and labels are created with it."""
    log_action("create")
    result = await workspace_service.create_workspace(workspace, user_id=user_id)
    return WorkspaceResponse.model_validate(result)


@workspaces_router.get(
    "",
    response_description="List the workspaces of the current user",
    status_code=status.HTTP_200_OK,
)
async def list_my_workspaces(
    user_id: uuid.UUID = Depends(require_current_user_id),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> list[WorkspaceResponse]:
    log_action("list")
    result = await workspace_service.list_for_user(user_id)
    return [WorkspaceResponse.model_validate(w) for w in result]


@workspaces_router.get(
    "/{url_key}",
    response_description="Get a workspace by URL key",
    status_code=status.HTTP_200_OK,
)
async def get_workspace_by_url_key(
    url_key: str,
    user_id: uuid.UUID = Depends(require_current_user_id),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> WorkspaceResponse:
    log_action("get_by_url_key")
    result = await workspace_service.get_by_url_key(url_key, user_id=user_id)
    return WorkspaceResponse.model_validate(result)


@workspaces_router.get(
    "/{workspace_id}/members",
    response_description="List the members of a workspace",
    status_code=status.HTTP_200_OK,
)
async def list_workspace_members(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> list[WorkspaceMemberResponse]:
    log_action("list_members")
    log_entity("workspace", workspace_id)
    result = await workspace_service.list_members(workspace_id, user_id=user_id)
    return [WorkspaceMemberResponse.model_validate(m) for m in result]
