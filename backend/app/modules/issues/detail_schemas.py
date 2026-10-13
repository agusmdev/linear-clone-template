"""Schemas of the issue detail resources: comments, relations, activity, subscribers."""

import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.database.mixins import OrmBaseModel
from app.modules.issues.models import IssueActivityAction, IssueRelationType
from app.modules.issues.schemas import IssueResponse
from app.modules.teams.schemas import WorkflowStateSummary
from app.user.schemas import UserSummary

COMMENT_BODY_MAX = 100_000


class IssueRef(OrmBaseModel):
    """A small issue reference (relations, notifications, search)."""

    id: uuid.UUID
    identifier: str
    title: str
    state: WorkflowStateSummary


# --- Comments ----------------------------------------------------------------


class CommentBase(BaseModel):
    # HTML from the TipTap editor.
    body: str = Field(..., min_length=1, max_length=COMMENT_BODY_MAX)


class CommentCreate(CommentBase):
    pass


class CommentUpdate(CommentBase):
    pass


class CommentResponse(CommentBase, OrmBaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    user_id: uuid.UUID | None
    user: UserSummary | None
    edited_at: datetime | None
    created_at: datetime
    updated_at: datetime


# --- Relations ---------------------------------------------------------------


class IssueRelationCreateType(enum.StrEnum):
    blocks = "blocks"
    # Stored as the other issue ``blocks`` this one.
    blocked_by = "blocked_by"
    related = "related"
    duplicate = "duplicate"


class IssueRelationDirection(enum.StrEnum):
    # This issue <type> ``issue`` (e.g. blocks).
    outgoing = "outgoing"
    # ``issue`` <type> this issue (e.g. blocked by).
    incoming = "incoming"


class IssueRelationCreate(BaseModel):
    related_issue_id: uuid.UUID
    type: IssueRelationCreateType


class IssueRelationResponse(BaseModel):
    id: uuid.UUID
    type: IssueRelationType
    direction: IssueRelationDirection
    issue: IssueRef
    created_at: datetime


# --- Activity ----------------------------------------------------------------


class IssueActivityResponse(OrmBaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    actor_id: uuid.UUID | None
    actor: UserSummary | None
    action: IssueActivityAction
    # For "updated": title, description, state, priority, assignee, labels,
    # project, cycle, parent, estimate, due_date. Values are display text.
    field: str | None
    from_value: str | None
    to_value: str | None
    created_at: datetime


# --- Subscribers -------------------------------------------------------------


class IssueSubscriberCreate(BaseModel):
    # Default: the current user.
    user_id: uuid.UUID | None = None


# --- Sub-issues --------------------------------------------------------------


class SubIssuesResponse(BaseModel):
    """The sub-issues of an issue (not archived) and the progress counts."""

    items: list[IssueResponse]
    total: int
    # Sub-issues whose state type is ``completed``.
    completed: int
