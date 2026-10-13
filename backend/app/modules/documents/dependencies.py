"""Dependency factory functions for the Document module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.documents.repository import DocumentRepository
from app.modules.documents.service import DocumentService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_document_service(
    repo: DocumentRepository = Depends(get_repository(DocumentRepository)),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> DocumentService:
    return DocumentService(repo=repo, workspace_service=workspace_service)
