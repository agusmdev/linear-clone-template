"""Issue schemas - request and response models."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel
from app.modules.labels.schemas import LabelSummary
from app.modules.teams.schemas import TeamSummary, WorkflowStateSummary
from app.user.schemas import UserSummary

TITLE_MAX = 500
DESCRIPTION_MAX = 200_000
LABELS_MAX = 50


class IssueCreate(BaseModel):
    """Create an issue. ``state_id`` defaults to the team's first unstarted state (Todo)."""

    team_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=TITLE_MAX)
    # HTML from the TipTap editor.
    description: str | None = Field(None, max_length=DESCRIPTION_MAX)
    state_id: uuid.UUID | None = None
    # 0 no priority, 1 urgent, 2 high, 3 medium, 4 low.
    priority: int = Field(0, ge=0, le=4)
    assignee_id: uuid.UUID | None = None
    label_ids: list[uuid.UUID] = Field(default_factory=list, max_length=LABELS_MAX)
    project_id: uuid.UUID | None = None
    cycle_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    estimate: int | None = Field(None, ge=0, le=1000)
    due_date: date | None = None
    # Manual order (list and board). Default: after the team's last issue.
    sort_order: float | None = Field(None, allow_inf_nan=False)


class IssueUpdateFields(BaseModel):
    title: str = Field(..., min_length=1, max_length=TITLE_MAX)
    description: str | None = Field(None, max_length=DESCRIPTION_MAX)
    state_id: uuid.UUID
    priority: int = Field(..., ge=0, le=4)
    assignee_id: uuid.UUID | None = None
    # Replaces the issue's labels.
    label_ids: list[uuid.UUID] = Field(..., max_length=LABELS_MAX)
    project_id: uuid.UUID | None = None
    cycle_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    estimate: int | None = Field(None, ge=0, le=1000)
    due_date: date | None = None
    sort_order: float = Field(..., allow_inf_nan=False)
    # true archives the issue (sets archived_at), false restores it.
    archived: bool


@partial_model
class IssueUpdate(IssueUpdateFields):
    """PATCH: every field can be left out; only the sent fields change."""

    pass


class IssueResponse(OrmBaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    team_id: uuid.UUID
    number: int
    # "<team key>-<number>", e.g. "ENG-12".
    identifier: str
    title: str
    description: str | None
    state_id: uuid.UUID
    priority: int
    assignee_id: uuid.UUID | None
    creator_id: uuid.UUID | None
    project_id: uuid.UUID | None
    cycle_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    estimate: int | None
    due_date: date | None
    sort_order: float
    started_at: datetime | None
    completed_at: datetime | None
    canceled_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    team: TeamSummary
    state: WorkflowStateSummary
    assignee: UserSummary | None
    creator: UserSummary | None
    labels: list[LabelSummary]


BULK_MAX = 250


class IssueBulkChanges(BaseModel):
    """The changes of POST /issues/bulk-update; every key is optional.

    ``label_ids`` replaces the labels; ``label_ids_add`` / ``label_ids_remove``
    add or remove labels and keep the others.
    """

    state_id: uuid.UUID | None = None
    priority: int | None = Field(None, ge=0, le=4)
    assignee_id: uuid.UUID | None = None
    label_ids: list[uuid.UUID] | None = Field(None, max_length=LABELS_MAX)
    label_ids_add: list[uuid.UUID] | None = Field(None, max_length=LABELS_MAX)
    label_ids_remove: list[uuid.UUID] | None = Field(None, max_length=LABELS_MAX)
    project_id: uuid.UUID | None = None
    cycle_id: uuid.UUID | None = None
    archived: bool | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "IssueBulkChanges":
        for name in ("state_id", "priority", "label_ids", "archived"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class IssueBulkUpdate(BaseModel):
    issue_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=BULK_MAX)
    update: IssueBulkChanges


class IssueBulkDelete(BaseModel):
    issue_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=BULK_MAX)


class IssueBulkResponse(BaseModel):
    items: list[IssueResponse]
