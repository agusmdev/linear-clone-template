"""Labels router: list, create, update and delete the labels of a workspace."""

import uuid

from fastapi import APIRouter, Body, Depends, status

from app.core.logging import log_action, log_entity
from app.modules.labels.dependencies import get_label_service
from app.modules.labels.schemas import LabelCreate, LabelResponse, LabelUpdate
from app.modules.labels.service import LabelService
from app.user.auth import require_current_user_id

labels_router = APIRouter(
    tags=["labels"],
    dependencies=[Depends(require_current_user_id)],
)


@labels_router.get(
    "/workspaces/{workspace_id}/labels",
    response_description="List the labels of a workspace",
    status_code=status.HTTP_200_OK,
)
async def list_labels(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    label_service: LabelService = Depends(get_label_service),
) -> list[LabelResponse]:
    log_action("list")
    log_entity("workspace", workspace_id)
    result = await label_service.list_labels(workspace_id, user_id=user_id)
    return [LabelResponse.model_validate(label) for label in result]


@labels_router.post(
    "/workspaces/{workspace_id}/labels",
    response_description="Create a label",
    status_code=status.HTTP_201_CREATED,
)
async def create_label(
    workspace_id: uuid.UUID,
    label: LabelCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    label_service: LabelService = Depends(get_label_service),
) -> LabelResponse:
    log_action("create")
    log_entity("workspace", workspace_id)
    result = await label_service.create_label(workspace_id, label, user_id=user_id)
    return LabelResponse.model_validate(result)


@labels_router.patch(
    "/labels/{label_id}",
    response_description="Rename or recolor a label",
    status_code=status.HTTP_200_OK,
)
async def update_label(
    label_id: uuid.UUID,
    label: LabelUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    label_service: LabelService = Depends(get_label_service),
) -> LabelResponse:
    log_action("update")
    log_entity("label", label_id)
    result = await label_service.update_label(label_id, label, user_id=user_id)
    return LabelResponse.model_validate(result)


@labels_router.delete(
    "/labels/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete a label (it is removed from its issues)",
)
async def delete_label(
    label_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    label_service: LabelService = Depends(get_label_service),
) -> None:
    log_action("delete")
    log_entity("label", label_id)
    await label_service.delete_label(label_id, user_id=user_id)
