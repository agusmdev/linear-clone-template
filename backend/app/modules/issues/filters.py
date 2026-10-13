"""Issue filters for GET /issues.

Plain column filters run through fastapi-filter. The fields in
``IssueFilter.CUSTOM_FIELDS`` need a subquery or a special value, so
``IssueFilter.filter`` applies them itself.
"""

import re
import uuid
from typing import Any, ClassVar

from pydantic import field_validator
from sqlalchemy import or_, select
from sqlalchemy.sql import Select

from app.core.filters import ModelFilter
from app.modules.issues.models import Issue, IssueLabel, IssueSubscriber
from app.modules.teams.models import WorkflowState, WorkflowStateType

ME = "me"
NONE = "none"
_IDENTIFIER = re.compile(r"^(?:[A-Za-z]{2,5}-)?(\d+)$")


def _user_refs(values: list[str] | None, *, allow_none: bool) -> list[str] | None:
    if values is None:
        return None
    return [ref for v in values if (ref := _user_ref(v, allow_none=allow_none))]


def _user_ref(value: str | None, *, allow_none: bool) -> str | None:
    """Accept a user id, ``me``, and (if allowed) ``none``."""
    if value is None or value == ME or (allow_none and value == NONE):
        return value
    try:
        uuid.UUID(value)
    except ValueError as err:
        allowed = "a user id, 'me' or 'none'" if allow_none else "a user id or 'me'"
        raise ValueError(f"must be {allowed}") from err
    return value


def _ids_or_null(column: Any, values: list[str]) -> Any:
    """``column IN (ids)``, or ``IS NULL`` when ``none`` is one of the values."""
    ids = [uuid.UUID(v) for v in values if v != NONE]
    conditions = [column.in_(ids)] if ids else []
    if NONE in values:
        conditions.append(column.is_(None))
    return or_(*conditions)


class IssueFilter(ModelFilter):  # ?order_by= accepts Issue columns only (else 422)
    """Query parameters of GET /issues (``workspace_id`` is a separate parameter).

    ?team_id=           one team
    ?state_id__in=a,b   states
    ?state_type__in=started,unstarted
    ?priority__in=1,2
    ?assignee_id=<uuid>|me|none
    ?creator_id=<uuid>|me
    ?subscriber_id=<uuid>|me
    ?label_id=<uuid>    issues with this label
    ?assignee_id__in=<uuid>,me,none   any of these assignees
    ?creator_id__in=<uuid>,me         any of these creators
    ?label_id__in=a,b   issues with any of these labels
    ?project_id__in=<uuid>,none  ?cycle_id__in=<uuid>,none
    ?project_id= ?cycle_id= ?parent_id=   (parent_id__isnull=true: top-level only)
    ?include_archived=true  (default: archived issues are left out)
    ?search=            title or description (ILIKE), or the number ("12", "ENG-12")
    ?order_by=          e.g. sort_order, -priority, -created_at, -updated_at, due_date
    """

    CUSTOM_FIELDS: ClassVar[tuple[str, ...]] = (
        "state_type__in",
        "assignee_id",
        "creator_id",
        "subscriber_id",
        "label_id",
        "assignee_id__in",
        "creator_id__in",
        "label_id__in",
        "project_id__in",
        "cycle_id__in",
        "include_archived",
        "search",
    )

    order_by: list[str] = ["sort_order"]
    team_id: uuid.UUID | None = None
    state_id__in: list[uuid.UUID] | None = None
    priority__in: list[int] | None = None
    project_id: uuid.UUID | None = None
    cycle_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    parent_id__isnull: bool | None = None
    state_type__in: list[WorkflowStateType] | None = None
    assignee_id: str | None = None
    creator_id: str | None = None
    subscriber_id: str | None = None
    label_id: uuid.UUID | None = None
    assignee_id__in: list[str] | None = None
    creator_id__in: list[str] | None = None
    label_id__in: list[uuid.UUID] | None = None
    project_id__in: list[str] | None = None
    cycle_id__in: list[str] | None = None
    include_archived: bool | None = None
    search: str | None = None

    class Constants(ModelFilter.Constants):
        model = Issue

    @field_validator("assignee_id")
    @classmethod
    def _assignee(cls, value: str | None) -> str | None:
        return _user_ref(value, allow_none=True)

    @field_validator("creator_id", "subscriber_id")
    @classmethod
    def _user(cls, value: str | None) -> str | None:
        return _user_ref(value, allow_none=False)

    @field_validator("assignee_id__in")
    @classmethod
    def _assignees(cls, value: list[str] | None) -> list[str] | None:
        return _user_refs(value, allow_none=True)

    @field_validator("creator_id__in")
    @classmethod
    def _creators(cls, value: list[str] | None) -> list[str] | None:
        return _user_refs(value, allow_none=False)

    @field_validator("project_id__in", "cycle_id__in")
    @classmethod
    def _ids_or_none(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        for item in value:
            if item != NONE:
                try:
                    uuid.UUID(item)
                except ValueError as err:
                    raise ValueError("must be ids or 'none'") from err
        return value

    def resolve_me(self, user_id: uuid.UUID) -> None:
        """Replace ``me`` with the current user's id (the service calls this)."""
        for name in ("assignee_id", "creator_id", "subscriber_id"):
            if getattr(self, name) == ME:
                setattr(self, name, str(user_id))
        for name in ("assignee_id__in", "creator_id__in"):
            values = getattr(self, name)
            if values:
                setattr(self, name, [str(user_id) if v == ME else v for v in values])

    def filter(self, query: Any) -> Any:
        plain = self.model_copy(update=dict.fromkeys(self.CUSTOM_FIELDS))
        query = super(IssueFilter, plain).filter(query)
        return self._filter_custom(query)

    def sort(self, query: Any) -> Any:
        # A unique last key keeps pages stable when the sort values tie.
        return super().sort(query).order_by(Issue.id)

    def _filter_custom(self, query: Select[Any]) -> Select[Any]:
        if not self.include_archived:
            query = query.where(Issue.archived_at.is_(None))
        if self.state_type__in:
            query = query.where(
                Issue.state_id.in_(
                    select(WorkflowState.id).where(
                        WorkflowState.type.in_(self.state_type__in)
                    )
                )
            )
        if self.assignee_id == NONE:
            query = query.where(Issue.assignee_id.is_(None))
        elif self.assignee_id:
            query = query.where(Issue.assignee_id == uuid.UUID(self.assignee_id))
        if self.creator_id:
            query = query.where(Issue.creator_id == uuid.UUID(self.creator_id))
        if self.subscriber_id:
            query = query.where(
                Issue.id.in_(
                    select(IssueSubscriber.issue_id).where(
                        IssueSubscriber.user_id == uuid.UUID(self.subscriber_id)
                    )
                )
            )
        if self.label_id:
            query = query.where(
                Issue.id.in_(
                    select(IssueLabel.issue_id).where(
                        IssueLabel.label_id == self.label_id
                    )
                )
            )
        if self.assignee_id__in:
            query = query.where(_ids_or_null(Issue.assignee_id, self.assignee_id__in))
        if self.creator_id__in:
            query = query.where(
                Issue.creator_id.in_([uuid.UUID(v) for v in self.creator_id__in])
            )
        if self.project_id__in:
            query = query.where(_ids_or_null(Issue.project_id, self.project_id__in))
        if self.cycle_id__in:
            query = query.where(_ids_or_null(Issue.cycle_id, self.cycle_id__in))
        if self.label_id__in:
            query = query.where(
                Issue.id.in_(
                    select(IssueLabel.issue_id).where(
                        IssueLabel.label_id.in_(self.label_id__in)
                    )
                )
            )
        if self.search:
            conditions = [
                Issue.title.ilike(f"%{self.search}%"),
                Issue.description.ilike(f"%{self.search}%"),
            ]
            if match := _IDENTIFIER.match(self.search.strip()):
                conditions.append(Issue.number == int(match.group(1)))
            query = query.where(or_(*conditions))
        return query
