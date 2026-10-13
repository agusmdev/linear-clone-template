"""Search service - business logic layer."""

import uuid
from dataclasses import dataclass, field

from app.modules.documents.models import Document
from app.modules.issues.models import Issue
from app.modules.projects.models import Project
from app.modules.search.repository import SearchRepository
from app.modules.search.schemas import SearchType
from app.modules.workspaces.service import WorkspaceService
from app.services.base_crud_service import BaseService


@dataclass
class SearchResult:
    issues: list[Issue] = field(default_factory=list)
    documents: list[Document] = field(default_factory=list)
    projects: list[Project] = field(default_factory=list)


class SearchService(BaseService[Issue]):
    def __init__(
        self, repo: SearchRepository, workspace_service: WorkspaceService
    ) -> None:
        self.repo = repo
        self.workspace_service = workspace_service

    async def search(
        self,
        workspace_id: uuid.UUID,
        text: str,
        *,
        types: set[SearchType],
        limit: int,
        user_id: uuid.UUID,
    ) -> SearchResult:
        """Search the workspace. An empty (or blank) query returns no results."""
        await self.workspace_service.require_member(workspace_id, user_id)
        result = SearchResult()
        text = text.strip()
        if not text:
            return result
        if SearchType.issue in types:
            result.issues = await self.repo.search_issues(workspace_id, text, limit)
        if SearchType.document in types:
            result.documents = await self.repo.search_documents(
                workspace_id, text, limit
            )
        if SearchType.project in types:
            result.projects = await self.repo.search_projects(workspace_id, text, limit)
        return result
