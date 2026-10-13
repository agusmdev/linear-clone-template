"""Search router: workspace-wide search (command palette and search page)."""

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.logging import log_action, log_entity
from app.modules.search.dependencies import get_search_service
from app.modules.search.schemas import (
    SEARCH_LIMIT_MAX,
    DocumentSearchResult,
    IssueSearchResult,
    ProjectSearchResult,
    SearchResponse,
    SearchType,
)
from app.modules.search.service import SearchService
from app.user.auth import require_current_user_id

search_router = APIRouter(
    tags=["search"],
    dependencies=[Depends(require_current_user_id)],
)

_TYPES_PATTERN = r"^(issue|document|project)(,(issue|document|project))*$"


@search_router.get(
    "/workspaces/{workspace_id}/search",
    response_description="Search issues, documents and projects of a workspace",
    status_code=status.HTTP_200_OK,
)
async def search_workspace(
    workspace_id: uuid.UUID,
    q: str = Query("", max_length=200),
    types: str = Query("issue,document,project", pattern=_TYPES_PATTERN),
    limit: int = Query(10, ge=1, le=SEARCH_LIMIT_MAX),
    user_id: uuid.UUID = Depends(require_current_user_id),
    search_service: SearchService = Depends(get_search_service),
) -> SearchResponse:
    """Issues match title, description or identifier (``ENG-12``); documents
    title or content; projects name or description. ``limit`` is per type."""
    log_action("search")
    log_entity("workspace", workspace_id)
    result = await search_service.search(
        workspace_id,
        q,
        types={SearchType(t) for t in types.split(",")},
        limit=limit,
        user_id=user_id,
    )
    return SearchResponse(
        issues=[IssueSearchResult.model_validate(i) for i in result.issues],
        documents=[DocumentSearchResult.model_validate(d) for d in result.documents],
        projects=[ProjectSearchResult.model_validate(p) for p in result.projects],
    )
