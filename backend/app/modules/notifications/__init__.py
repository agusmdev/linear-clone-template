"""Notifications module (inbox, UX-3).

The issue service uses this module's service, so (like ``issues``) this file
re-exports only models and schemas. Import the service from ``.service``.
"""

from .models import Notification, NotificationType
from .schemas import (
    MarkAllReadRequest,
    MarkAllReadResponse,
    NotificationComment,
    NotificationIssueRef,
    NotificationResponse,
    NotificationUpdate,
    UnreadCountResponse,
)

__all__ = [
    "MarkAllReadRequest",
    "MarkAllReadResponse",
    "Notification",
    "NotificationComment",
    "NotificationIssueRef",
    "NotificationResponse",
    "NotificationType",
    "NotificationUpdate",
    "UnreadCountResponse",
]
