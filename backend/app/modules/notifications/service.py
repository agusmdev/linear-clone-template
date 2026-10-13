"""Notification service - the inbox (UX-3) and the creation of notifications.

Reads and writes are scoped to the current user: another user's notification
gives the same 404 as a missing one. Listing and counting also need the user
to be a member of the workspace (else the 404 of a missing workspace).

The issue service calls ``notify_assigned`` and ``notify_status_changed``
after it saved a change.
"""

import uuid
from datetime import UTC, datetime

from fastapi_pagination import Page, Params

from app.modules.notifications.filters import NotificationFilter
from app.modules.notifications.models import Notification, NotificationType
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.schemas import NotificationUpdate
from app.modules.workspaces.service import WorkspaceService
from app.repositories.base_repository import QueryOptions
from app.repositories.exceptions import NotFoundError
from app.services.base_crud_service import BaseService


class NotificationService(BaseService[Notification]):
    def __init__(
        self, repo: NotificationRepository, workspace_service: WorkspaceService
    ) -> None:
        self.repo = repo
        self.workspace_service = workspace_service

    # --- inbox -------------------------------------------------------------

    async def list_notifications(
        self,
        workspace_id: uuid.UUID,
        pagination_params: Params,
        notification_filter: NotificationFilter,
        *,
        user_id: uuid.UUID,
    ) -> Page[Notification]:
        await self.workspace_service.require_member(workspace_id, user_id)
        base_query = self.repo.select_full().where(
            Notification.workspace_id == workspace_id,
            Notification.user_id == user_id,
        )
        return await self.repo.get_all_paginated(
            pagination_params,
            notification_filter,
            QueryOptions(base_query=base_query),
        )

    async def unread_count(self, workspace_id: uuid.UUID, *, user_id: uuid.UUID) -> int:
        await self.workspace_service.require_member(workspace_id, user_id)
        return await self.repo.count_unread(workspace_id, user_id)

    async def get_mine(
        self, notification_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> Notification:
        notification = await self.repo.get_full(notification_id)
        if notification is None or notification.user_id != user_id:
            raise NotFoundError(detail=f"Notification {notification_id} not found")
        self._log_entity(notification.id)
        return notification

    async def update_notification(
        self,
        notification_id: uuid.UUID,
        data: NotificationUpdate,
        *,
        user_id: uuid.UUID,
    ) -> Notification:
        notification = await self.get_mine(notification_id, user_id=user_id)
        changes = data.model_dump(exclude_unset=True)
        now = datetime.now(tz=UTC)
        values: dict[str, datetime | None] = {}
        if "read" in changes and changes["read"] != (notification.read_at is not None):
            values["read_at"] = now if changes["read"] else None
        if "archived" in changes and changes["archived"] != (
            notification.archived_at is not None
        ):
            values["archived_at"] = now if changes["archived"] else None
        if not values:
            return notification
        values["updated_at"] = now
        updated = await self.repo.update_values(notification.id, values)
        if updated is None:
            raise NotFoundError(detail=f"Notification {notification_id} not found")
        return updated

    async def mark_all_read(
        self, workspace_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> int:
        await self.workspace_service.require_member(workspace_id, user_id)
        return await self.repo.mark_all_read(
            workspace_id, user_id, datetime.now(tz=UTC)
        )

    async def delete_notification(
        self, notification_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        notification = await self.get_mine(notification_id, user_id=user_id)
        await self.repo.delete(notification.id)

    # --- creation (called by the issue service) ----------------------------

    async def notify_assigned(
        self,
        *,
        workspace_id: uuid.UUID,
        issue_id: uuid.UUID,
        assignee_id: uuid.UUID | None,
        actor_id: uuid.UUID,
    ) -> None:
        """``assigned`` to the new assignee, unless the actor assigned themself."""
        if assignee_id is None or assignee_id == actor_id:
            return
        await self.repo.insert_rows(
            [
                {
                    "user_id": assignee_id,
                    "workspace_id": workspace_id,
                    "issue_id": issue_id,
                    "actor_id": actor_id,
                    "type": NotificationType.assigned,
                }
            ]
        )

    async def notify_subscribers(
        self,
        notification_type: NotificationType,
        *,
        workspace_id: uuid.UUID,
        issue_id: uuid.UUID,
        actor_id: uuid.UUID,
        exclude: set[uuid.UUID] | None = None,
    ) -> None:
        """One notification for every subscriber of the issue except the actor."""
        skip = {actor_id} | (exclude or set())
        recipients = await self.repo.subscriber_ids(issue_id) - skip
        await self.repo.insert_rows(
            [
                {
                    "user_id": recipient,
                    "workspace_id": workspace_id,
                    "issue_id": issue_id,
                    "actor_id": actor_id,
                    "type": notification_type,
                }
                for recipient in sorted(recipients)
            ]
        )

    async def notify_status_changed(
        self,
        *,
        workspace_id: uuid.UUID,
        issue_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> None:
        await self.notify_subscribers(
            NotificationType.status_changed,
            workspace_id=workspace_id,
            issue_id=issue_id,
            actor_id=actor_id,
        )
