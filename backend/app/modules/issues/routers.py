"""Issues router: create, list, get (by id or identifier), update, delete."""

import uuid

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi_filter import FilterDepends
from fastapi_pagination import Page, Params

from app.core.logging import log_action, log_entity
from app.modules.issues.dependencies import get_issue_service
from app.modules.issues.filters import IssueFilter
from app.modules.issues.schemas import IssueCreate, IssueResponse, IssueUpdate
from app.modules.issues.service import IssueService
from app.user.auth import require_current_user_id

issues_router = APIRouter(
    tags=["issues"],
    dependencies=[Depends(require_current_user_id)],
)


@issues_router.get(
    "/issues",
    response_description="List the issues of a workspace",
    status_code=status.HTTP_200_OK,
)
async def list_issues(
    workspace_id: uuid.UUID = Query(...),
    pagination: Params = Depends(),
    # FilterDepends, not Depends(): plain Depends() reads list fields from the body.
    issue_filter: IssueFilter = FilterDepends(IssueFilter),
    user_id: uuid.UUID = Depends(require_current_user_id),
    issue_service: IssueService = Depends(get_issue_service),
) -> Page[IssueResponse]:
    """List issues of one workspace. Filters: see ``IssueFilter``."""
    log_action("list")
    log_entity("workspace", workspace_id)
    result = await issue_service.list_issues(
        workspace_id, pagination, issue_filter, user_id=user_id
    )
    return Page[IssueResponse](
        items=[IssueResponse.model_validate(i) for i in result.items],
        total=result.total,
        page=result.page,
        size=result.size,
        pages=result.pages,
    )


@issues_router.get(
    "/issues/{issue_id}",
    response_description="Get an issue by id",
    status_code=status.HTTP_200_OK,
)
async def get_issue(
    issue_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    issue_service: IssueService = Depends(get_issue_service),
) -> IssueResponse:
    log_action("get")
    result = await issue_service.get_for_member(issue_id, user_id=user_id)
    return IssueResponse.model_validate(result)


@issues_router.get(
    "/workspaces/{workspace_id}/issues/by-identifier/{identifier}",
    response_description="Get an issue by identifier (e.g. ENG-12)",
    status_code=status.HTTP_200_OK,
)
async def get_issue_by_identifier(
    workspace_id: uuid.UUID,
    identifier: str,
    user_id: uuid.UUID = Depends(require_current_user_id),
    issue_service: IssueService = Depends(get_issue_service),
) -> IssueResponse:
    log_action("get_by_identifier")
    result = await issue_service.get_by_identifier(
        workspace_id, identifier, user_id=user_id
    )
    return IssueResponse.model_validate(result)


@issues_router.post(
    "/issues",
    response_description="Create an issue",
    status_code=status.HTTP_201_CREATED,
)
async def create_issue(
    issue: IssueCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    issue_service: IssueService = Depends(get_issue_service),
) -> IssueResponse:
    log_action("create")
    result = await issue_service.create_issue(issue, user_id=user_id)
    return IssueResponse.model_validate(result)


@issues_router.patch(
    "/issues/{issue_id}",
    response_description="Update an issue",
    status_code=status.HTTP_200_OK,
)
async def update_issue(
    issue_id: uuid.UUID,
    issue: IssueUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    issue_service: IssueService = Depends(get_issue_service),
) -> IssueResponse:
    log_action("update")
    log_entity("issue", issue_id)
    result = await issue_service.update_issue(issue_id, issue, user_id=user_id)
    return IssueResponse.model_validate(result)


@issues_router.delete(
    "/issues/{issue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete an issue",
)
async def delete_issue(
    issue_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    issue_service: IssueService = Depends(get_issue_service),
) -> None:
    log_action("delete")
    log_entity("issue", issue_id)
    await issue_service.delete_issue(issue_id, user_id=user_id)
