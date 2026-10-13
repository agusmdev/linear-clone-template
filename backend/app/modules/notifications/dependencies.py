"""Dependency factory functions for the Notification module."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.service import NotificationService
from app.modules.workspaces.dependencies import get_workspace_service
from app.modules.workspaces.service import WorkspaceService


def get_notification_service(
    repo: NotificationRepository = Depends(get_repository(NotificationRepository)),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
) -> NotificationService:
    return NotificationService(repo=repo, workspace_service=workspace_service)
