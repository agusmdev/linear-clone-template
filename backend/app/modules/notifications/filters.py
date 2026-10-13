"""Notification filters for GET /notifications."""

import uuid
from typing import Any, ClassVar

from app.core.filters import ModelFilter
from app.modules.notifications.models import Notification, NotificationType


class NotificationFilter(ModelFilter):
    """Query parameters of GET /notifications (``workspace_id`` is separate).

    ?unread=true            only unread notifications (false: only read ones)
    ?include_archived=true  (default: archived notifications are left out)
    ?type=assigned          one type
    ?issue_id=<uuid>        the notifications of one issue
    ?order_by=              default -created_at (newest first)
    """

    CUSTOM_FIELDS: ClassVar[tuple[str, ...]] = ("unread", "include_archived")

    order_by: list[str] = ["-created_at"]
    type: NotificationType | None = None
    issue_id: uuid.UUID | None = None
    unread: bool | None = None
    include_archived: bool | None = None

    class Constants(ModelFilter.Constants):
        model = Notification

    def filter(self, query: Any) -> Any:
        plain = self.model_copy(update=dict.fromkeys(self.CUSTOM_FIELDS))
        query = super(NotificationFilter, plain).filter(query)
        if not self.include_archived:
            query = query.where(Notification.archived_at.is_(None))
        if self.unread is True:
            query = query.where(Notification.read_at.is_(None))
        elif self.unread is False:
            query = query.where(Notification.read_at.is_not(None))
        return query

    def sort(self, query: Any) -> Any:
        # A unique last key keeps pages stable when the sort values tie.
        return super().sort(query).order_by(Notification.id)
