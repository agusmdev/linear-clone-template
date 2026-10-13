"""Projects router: list (per workspace), create, get, update, delete."""

import uuid

from fastapi import APIRouter, Body, Depends, Query, status

from app.core.logging import log_action, log_entity
from app.modules.projects.dependencies import get_project_service
from app.modules.projects.models import ProjectStatus
from app.modules.projects.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from app.modules.projects.service import ProjectService
from app.user.auth import require_current_user_id

projects_router = APIRouter(
    tags=["projects"],
    dependencies=[Depends(require_current_user_id)],
)


@projects_router.get(
    "/workspaces/{workspace_id}/projects",
    response_description="List the projects of a workspace",
    status_code=status.HTTP_200_OK,
)
async def list_projects(
    workspace_id: uuid.UUID,
    project_status: ProjectStatus | None = Query(None, alias="status"),
    team_id: uuid.UUID | None = Query(None),
    user_id: uuid.UUID = Depends(require_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
) -> list[ProjectResponse]:
    """Projects by ``sort_order``; optional ``status`` and ``team_id`` filters."""
    log_action("list")
    log_entity("workspace", workspace_id)
    result = await project_service.list_projects(
        workspace_id, user_id=user_id, status=project_status, team_id=team_id
    )
    return [ProjectResponse.model_validate(p) for p in result]


@projects_router.post(
    "/projects",
    response_description="Create a project",
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    project: ProjectCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    log_action("create")
    result = await project_service.create_project(project, user_id=user_id)
    return ProjectResponse.model_validate(result)


@projects_router.get(
    "/projects/{project_id}",
    response_description="Get a project",
    status_code=status.HTTP_200_OK,
)
async def get_project(
    project_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    log_action("get")
    result = await project_service.get_project(project_id, user_id=user_id)
    return ProjectResponse.model_validate(result)


@projects_router.patch(
    "/projects/{project_id}",
    response_description="Update a project",
    status_code=status.HTTP_200_OK,
)
async def update_project(
    project_id: uuid.UUID,
    project: ProjectUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    log_action("update")
    log_entity("project", project_id)
    result = await project_service.update_project(project_id, project, user_id=user_id)
    return ProjectResponse.model_validate(result)


@projects_router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete a project",
)
async def delete_project(
    project_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    project_service: ProjectService = Depends(get_project_service),
) -> None:
    log_action("delete")
    log_entity("project", project_id)
    await project_service.delete_project(project_id, user_id=user_id)
