"""Labels router: labels of a workspace."""

import uuid

from fastapi import APIRouter, Depends, status

from app.core.logging import log_action, log_entity
from app.modules.labels.dependencies import get_label_service
from app.modules.labels.schemas import LabelResponse
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
