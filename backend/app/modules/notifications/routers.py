"""Notifications router (inbox, UX-3): list, unread count, read/archive, delete."""

import uuid

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi_filter import FilterDepends
from fastapi_pagination import Page, Params

from app.core.logging import log_action, log_entity
from app.modules.notifications.dependencies import get_notification_service
from app.modules.notifications.filters import NotificationFilter
from app.modules.notifications.schemas import (
    MarkAllReadRequest,
    MarkAllReadResponse,
    NotificationResponse,
    NotificationUpdate,
    UnreadCountResponse,
)
from app.modules.notifications.service import NotificationService
from app.user.auth import require_current_user_id

notifications_router = APIRouter(
    tags=["notifications"],
    dependencies=[Depends(require_current_user_id)],
)


@notifications_router.get(
    "/notifications",
    response_description="List my notifications in a workspace (newest first)",
    status_code=status.HTTP_200_OK,
)
async def list_notifications(
    workspace_id: uuid.UUID = Query(...),
    pagination: Params = Depends(),
    # FilterDepends, not Depends(): plain Depends() reads list fields from the body.
    notification_filter: NotificationFilter = FilterDepends(NotificationFilter),
    user_id: uuid.UUID = Depends(require_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> Page[NotificationResponse]:
    log_action("list")
    log_entity("workspace", workspace_id)
    result = await notification_service.list_notifications(
        workspace_id, pagination, notification_filter, user_id=user_id
    )
    return Page[NotificationResponse](
        items=[NotificationResponse.model_validate(n) for n in result.items],
        total=result.total,
        page=result.page,
        size=result.size,
        pages=result.pages,
    )


@notifications_router.get(
    "/notifications/unread-count",
    response_description="Count my unread, not archived notifications",
    status_code=status.HTTP_200_OK,
)
async def unread_count(
    workspace_id: uuid.UUID = Query(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> UnreadCountResponse:
    log_action("unread_count")
    log_entity("workspace", workspace_id)
    count = await notification_service.unread_count(workspace_id, user_id=user_id)
    return UnreadCountResponse(count=count)


@notifications_router.post(
    "/notifications/mark-all-read",
    response_description="Mark all my notifications of a workspace as read",
    status_code=status.HTTP_200_OK,
)
async def mark_all_read(
    body: MarkAllReadRequest = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> MarkAllReadResponse:
    log_action("mark_all_read")
    log_entity("workspace", body.workspace_id)
    updated = await notification_service.mark_all_read(
        body.workspace_id, user_id=user_id
    )
    return MarkAllReadResponse(updated=updated)


@notifications_router.patch(
    "/notifications/{notification_id}",
    response_description="Mark a notification read/unread or archive it",
    status_code=status.HTTP_200_OK,
)
async def update_notification(
    notification_id: uuid.UUID,
    notification: NotificationUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    log_action("update")
    result = await notification_service.update_notification(
        notification_id, notification, user_id=user_id
    )
    return NotificationResponse.model_validate(result)


@notifications_router.delete(
    "/notifications/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete a notification",
)
async def delete_notification(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    notification_service: NotificationService = Depends(get_notification_service),
) -> None:
    log_action("delete")
    log_entity("notification", notification_id)
    await notification_service.delete_notification(notification_id, user_id=user_id)
