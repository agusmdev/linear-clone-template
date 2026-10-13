"""Documents router: list, create, get, update, delete."""

import uuid

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi_filter import FilterDepends
from fastapi_pagination import Page, Params

from app.core.logging import log_action, log_entity
from app.modules.documents.dependencies import get_document_service
from app.modules.documents.filters import DocumentFilter
from app.modules.documents.schemas import (
    DocumentCreate,
    DocumentResponse,
    DocumentSummary,
    DocumentUpdate,
)
from app.modules.documents.service import DocumentService
from app.user.auth import require_current_user_id

documents_router = APIRouter(
    tags=["documents"],
    dependencies=[Depends(require_current_user_id)],
)


@documents_router.get(
    "/documents",
    response_description="List the documents of a workspace",
    status_code=status.HTTP_200_OK,
)
async def list_documents(
    workspace_id: uuid.UUID = Query(...),
    pagination: Params = Depends(),
    # FilterDepends, not Depends(): plain Depends() reads list fields from the body.
    document_filter: DocumentFilter = FilterDepends(DocumentFilter),
    user_id: uuid.UUID = Depends(require_current_user_id),
    document_service: DocumentService = Depends(get_document_service),
) -> Page[DocumentSummary]:
    """List documents of one workspace. Filters: see ``DocumentFilter``."""
    log_action("list")
    log_entity("workspace", workspace_id)
    result = await document_service.list_documents(
        workspace_id, pagination, document_filter, user_id=user_id
    )
    return Page[DocumentSummary](
        items=[DocumentSummary.model_validate(d) for d in result.items],
        total=result.total,
        page=result.page,
        size=result.size,
        pages=result.pages,
    )


@documents_router.post(
    "/documents",
    response_description="Create a document",
    status_code=status.HTTP_201_CREATED,
)
async def create_document(
    document: DocumentCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    log_action("create")
    result = await document_service.create_document(document, user_id=user_id)
    return DocumentResponse.model_validate(result)


@documents_router.get(
    "/documents/{document_id}",
    response_description="Get a document",
    status_code=status.HTTP_200_OK,
)
async def get_document(
    document_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    log_action("get")
    result = await document_service.get_for_member(document_id, user_id=user_id)
    return DocumentResponse.model_validate(result)


@documents_router.patch(
    "/documents/{document_id}",
    response_description="Update a document",
    status_code=status.HTTP_200_OK,
)
async def update_document(
    document_id: uuid.UUID,
    document: DocumentUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    document_service: DocumentService = Depends(get_document_service),
) -> DocumentResponse:
    log_action("update")
    result = await document_service.update_document(
        document_id, document, user_id=user_id
    )
    return DocumentResponse.model_validate(result)


@documents_router.delete(
    "/documents/{document_id}",
    response_description="Delete a document",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_document(
    document_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    document_service: DocumentService = Depends(get_document_service),
) -> None:
    log_action("delete")
    await document_service.delete_document(document_id, user_id=user_id)
