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

    def resolve_me(self, user_id: uuid.UUID) -> None:
        """Replace ``me`` with the current user's id (the service calls this)."""
        for name in ("assignee_id", "creator_id", "subscriber_id"):
            if getattr(self, name) == ME:
                setattr(self, name, str(user_id))

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
        if self.search:
            conditions = [
                Issue.title.ilike(f"%{self.search}%"),
                Issue.description.ilike(f"%{self.search}%"),
            ]
            if match := _IDENTIFIER.match(self.search.strip()):
                conditions.append(Issue.number == int(match.group(1)))
            query = query.where(or_(*conditions))
        return query
