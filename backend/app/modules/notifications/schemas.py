"""Notification schemas - request and response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel
from app.modules.notifications.models import NotificationType
from app.modules.teams.schemas import WorkflowStateSummary
from app.user.schemas import UserSummary


class NotificationIssueRef(OrmBaseModel):
    """``IssueRef`` embedded in a notification: ``{id, identifier, title, state}``."""

    id: uuid.UUID
    identifier: str
    title: str
    state: WorkflowStateSummary


class NotificationResponse(OrmBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    issue_id: uuid.UUID | None
    actor_id: uuid.UUID | None
    type: NotificationType
    read_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    issue: NotificationIssueRef | None
    actor: UserSummary | None


class NotificationUpdateFields(BaseModel):
    # true sets read_at (now), false clears it.
    read: bool
    # true sets archived_at (now), false clears it.
    archived: bool


@partial_model
class NotificationUpdate(NotificationUpdateFields):
    """PATCH: every field can be left out; only the sent fields change."""

    pass


class MarkAllReadRequest(BaseModel):
    workspace_id: uuid.UUID


class MarkAllReadResponse(BaseModel):
    updated: int


class UnreadCountResponse(BaseModel):
    count: int
