"""Issue service - business logic layer.

Every method checks that the user is a member of the issue's workspace (a
non-member gets the 404 of a missing issue). Writes validate that every
referenced row (state, assignee, labels, project, cycle, parent) belongs to
the same workspace or team, and log one IssueActivity row per changed field.
"""

import re
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi_pagination import Page, Params

from app.core.logging import log_entities
from app.modules.issues.filters import IssueFilter
from app.modules.issues.models import Issue, IssueActivityAction, IssueRelationType
from app.modules.issues.repository import IssueRepository
from app.modules.issues.schemas import IssueBulkUpdate, IssueCreate, IssueUpdate
from app.modules.labels.models import Label
from app.modules.labels.service import LabelService
from app.modules.notifications.service import NotificationService
from app.modules.teams.models import Team, WorkflowState, WorkflowStateType
from app.modules.teams.service import TeamService
from app.modules.workspaces.exceptions import InvalidReferenceError
from app.modules.workspaces.service import WorkspaceService
from app.repositories.base_repository import QueryOptions
from app.repositories.exceptions import NotFoundError
from app.services.base_crud_service import BaseService
from app.user.models import User

_IDENTIFIER = re.compile(r"^([A-Za-z]{2,5})-(\d{1,9})$")

# Activity field of a relation, as seen from (source, target) of the stored row.
RELATION_FIELDS: dict[IssueRelationType, tuple[str, str]] = {
    IssueRelationType.blocks: ("relation_blocks", "relation_blocked_by"),
    IssueRelationType.related: ("relation_related", "relation_related"),
    IssueRelationType.duplicate: ("relation_duplicate_of", "relation_duplicated_by"),
}

# Fields copied to the issue as they are, with their activity value.
_PLAIN_FIELDS = ("title", "priority", "estimate", "due_date")


def _text(value: Any) -> str | None:
    return None if value is None else str(value)


def _change(
    actor_id: uuid.UUID,
    field: str,
    old: Any,
    new: Any,
    *,
    issue_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """An ``updated`` activity row; ``issue_id`` logs it on another issue."""
    row: dict[str, Any] = {
        "actor_id": actor_id,
        "action": IssueActivityAction.updated,
        "field": field,
        "from_value": _text(old),
        "to_value": _text(new),
    }
    if issue_id is not None:
        row["issue_id"] = issue_id
    return row


def state_timestamps(
    issue: Issue | None, new_type: WorkflowStateType, now: datetime
) -> dict[str, datetime | None]:
    """started_at / completed_at / canceled_at after a move to a state of ``new_type``."""
    started_at = issue.started_at if issue else None
    if new_type in (WorkflowStateType.backlog, WorkflowStateType.unstarted):
        return {"started_at": None, "completed_at": None, "canceled_at": None}
    if new_type == WorkflowStateType.started:
        return {
            "started_at": started_at or now,
            "completed_at": None,
            "canceled_at": None,
        }
    if new_type == WorkflowStateType.completed:
        return {"started_at": started_at, "completed_at": now, "canceled_at": None}
    return {"started_at": started_at, "completed_at": None, "canceled_at": now}


class IssueService(BaseService[Issue]):
    def __init__(
        self,
        repo: IssueRepository,
        workspace_service: WorkspaceService,
        team_service: TeamService,
        label_service: LabelService,
        notification_service: NotificationService,
    ) -> None:
        self.repo = repo
        self.workspace_service = workspace_service
        self.team_service = team_service
        self.label_service = label_service
        self.notification_service = notification_service

    # --- reads -------------------------------------------------------------

    async def get_for_member(self, issue_id: uuid.UUID, *, user_id: uuid.UUID) -> Issue:
        issue = await self.repo.get_full(issue_id)
        detail = f"Issue {issue_id} not found"
        if issue is None:
            raise NotFoundError(detail=detail)
        try:
            await self.workspace_service.require_member(issue.workspace_id, user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        self._log_entity(issue.id)
        return issue

    async def get_by_identifier(
        self, workspace_id: uuid.UUID, identifier: str, *, user_id: uuid.UUID
    ) -> Issue:
        await self.workspace_service.require_member(workspace_id, user_id)
        detail = f"Issue {identifier} not found"
        match = _IDENTIFIER.match(identifier)
        if match is None:
            raise NotFoundError(detail=detail)
        team = await self.team_service.get_by_key(workspace_id, match.group(1))
        if team is None:
            raise NotFoundError(detail=detail)
        issue = await self.repo.get_by_number(team.id, int(match.group(2)))
        if issue is None:
            raise NotFoundError(detail=detail)
        self._log_entity(issue.id)
        return issue

    async def list_issues(
        self,
        workspace_id: uuid.UUID,
        pagination_params: Params,
        issue_filter: IssueFilter,
        *,
        user_id: uuid.UUID,
    ) -> Page[Issue]:
        await self.workspace_service.require_member(workspace_id, user_id)
        issue_filter.resolve_me(user_id)
        base_query = self.repo.select_full().where(Issue.workspace_id == workspace_id)
        return await self.repo.get_all_paginated(
            pagination_params, issue_filter, QueryOptions(base_query=base_query)
        )

    # --- validation helpers --------------------------------------------------

    async def _state_of_team(self, state_id: uuid.UUID, team: Team) -> WorkflowState:
        state = await self.team_service.get_state(state_id)
        if state is None or state.team_id != team.id:
            raise InvalidReferenceError(
                detail=f"State {state_id} is not a state of team {team.key}"
            )
        return state

    async def _check_assignee(
        self, workspace_id: uuid.UUID, assignee_id: uuid.UUID | None
    ) -> None:
        if assignee_id is not None and not await self.workspace_service.are_members(
            workspace_id, {assignee_id}
        ):
            raise InvalidReferenceError(
                detail=f"User {assignee_id} is not a member of this workspace"
            )

    async def _labels(
        self, workspace_id: uuid.UUID, label_ids: set[uuid.UUID]
    ) -> list[Label]:
        labels = await self.label_service.labels_of_workspace(workspace_id, label_ids)
        if labels is None:
            raise InvalidReferenceError(
                detail="Every label must be a label of this workspace"
            )
        return labels

    async def _project_name(
        self, workspace_id: uuid.UUID, project_id: uuid.UUID | None
    ) -> str | None:
        if project_id is None:
            return None
        project = await self.repo.get_project(project_id)
        if project is None or project.workspace_id != workspace_id:
            raise InvalidReferenceError(
                detail=f"Project {project_id} is not in this workspace"
            )
        return project.name

    async def _cycle_name(
        self, team_id: uuid.UUID, cycle_id: uuid.UUID | None
    ) -> str | None:
        if cycle_id is None:
            return None
        cycle = await self.repo.get_cycle(cycle_id)
        if cycle is None or cycle.team_id != team_id:
            raise InvalidReferenceError(
                detail=f"Cycle {cycle_id} is not a cycle of the issue's team"
            )
        return cycle.name or f"Cycle {cycle.number}"

    async def _parent_identifier(
        self,
        workspace_id: uuid.UUID,
        parent_id: uuid.UUID | None,
        issue_id: uuid.UUID | None = None,
    ) -> str | None:
        """Validate a parent; for an existing issue, refuse a cycle in the tree."""
        if parent_id is None:
            return None
        parent = await self.repo.get_full(parent_id)
        if parent is None or parent.workspace_id != workspace_id:
            raise InvalidReferenceError(
                detail=f"Parent issue {parent_id} is not in this workspace"
            )
        if issue_id is not None:
            ancestor: uuid.UUID | None = parent_id
            seen: set[uuid.UUID] = set()
            while ancestor is not None and ancestor not in seen:
                if ancestor == issue_id:
                    raise InvalidReferenceError(
                        detail="An issue cannot be its own parent or ancestor"
                    )
                seen.add(ancestor)
                ancestor = await self.repo.parent_id_of(ancestor)
        return parent.identifier

    @staticmethod
    def _user_label(user: User | None) -> str | None:
        if user is None:
            return None
        return user.display_name or user.email

    # --- writes ------------------------------------------------------------

    async def create_issue(self, data: IssueCreate, *, user_id: uuid.UUID) -> Issue:
        team = await self.team_service.get_for_member(data.team_id, user_id=user_id)
        workspace_id = team.workspace_id
        if data.state_id is not None:
            state = await self._state_of_team(data.state_id, team)
        else:
            state = await self.team_service.default_state(team.id)
        await self._check_assignee(workspace_id, data.assignee_id)
        label_ids = set(data.label_ids)
        await self._labels(workspace_id, label_ids)
        await self._project_name(workspace_id, data.project_id)
        await self._cycle_name(team.id, data.cycle_id)
        parent = await self._parent_identifier(workspace_id, data.parent_id)

        now = datetime.now(tz=UTC)
        values: dict[str, Any] = {
            **data.model_dump(exclude={"label_ids", "state_id", "sort_order"}),
            "workspace_id": workspace_id,
            "state_id": state.id,
            "creator_id": user_id,
            "sort_order": (
                data.sort_order
                if data.sort_order is not None
                else await self.repo.next_sort_order(workspace_id)
            ),
            **state_timestamps(None, state.type, now),
        }
        subscribers = {user_id} | ({data.assignee_id} if data.assignee_id else set())
        activities: list[dict[str, Any]] = [
            {"actor_id": user_id, "action": IssueActivityAction.created}
        ]
        if parent is not None:
            activities.append(_change(user_id, "parent", None, parent))
        issue = await self.repo.create_issue(
            values,
            label_ids=label_ids,
            subscriber_ids=subscribers,
            activities=activities,
            parent_activity=(
                None
                if data.parent_id is None
                else _change(user_id, "sub_issue", None, None, issue_id=data.parent_id)
            ),
        )
        await self.notification_service.notify_assigned(
            workspace_id=workspace_id,
            issue_id=issue.id,
            assignee_id=issue.assignee_id,
            actor_id=user_id,
        )
        self._log_entity(issue.id)
        return issue

    async def update_issue(
        self, issue_id: uuid.UUID, data: IssueUpdate, *, user_id: uuid.UUID
    ) -> Issue:
        issue = await self.get_for_member(issue_id, user_id=user_id)
        plan = await self._plan_update(
            issue, data.model_dump(exclude_unset=True), user_id=user_id
        )
        if plan is None:
            return issue
        updated = await self.repo.update_issue(issue.id, **plan)
        await self._notify_update(issue, plan["values"], user_id=user_id)
        self._log_entity(issue.id)
        return updated

    async def _notify_update(
        self, issue: Issue, values: dict[str, Any], *, user_id: uuid.UUID
    ) -> None:
        """Notifications of a written update: new assignee, status change."""
        if "assignee_id" in values:
            await self.notification_service.notify_assigned(
                workspace_id=issue.workspace_id,
                issue_id=issue.id,
                assignee_id=values["assignee_id"],
                actor_id=user_id,
            )
        if "state_id" in values:
            await self.notification_service.notify_status_changed(
                workspace_id=issue.workspace_id,
                issue_id=issue.id,
                state_id=values["state_id"],
                actor_id=user_id,
            )

    async def _plan_update(
        self, issue: Issue, changes: dict[str, Any], *, user_id: uuid.UUID
    ) -> dict[str, Any] | None:
        """Validate ``changes`` against ``issue``: the write for the repository.

        Returns ``None`` when nothing changes. Else a dict with ``values``,
        ``label_ids``, ``subscriber_ids`` and ``activities`` (the keyword
        arguments of ``IssueRepository.update_issue``).
        """
        values: dict[str, Any] = {}
        activities: list[dict[str, Any]] = []
        subscribers: set[uuid.UUID] = set()
        label_ids: set[uuid.UUID] | None = None
        now = datetime.now(tz=UTC)

        def log(field: str, old: Any, new: Any) -> None:
            activities.append(_change(user_id, field, old, new))

        for field in _PLAIN_FIELDS:
            if field in changes and changes[field] != getattr(issue, field):
                values[field] = changes[field]
                log(field, getattr(issue, field), changes[field])

        if "description" in changes and changes["description"] != issue.description:
            values["description"] = changes["description"]
            # The HTML can be long: the activity only says that it changed.
            log("description", None, None)

        if "sort_order" in changes and changes["sort_order"] != issue.sort_order:
            # Reordering is not shown in the history.
            values["sort_order"] = changes["sort_order"]

        if "state_id" in changes and changes["state_id"] != issue.state_id:
            team = await self.team_service.get_for_member(
                issue.team_id, user_id=user_id
            )
            state = await self._state_of_team(changes["state_id"], team)
            values["state_id"] = state.id
            values.update(state_timestamps(issue, state.type, now))
            log("state", issue.state.name, state.name)

        if "assignee_id" in changes and changes["assignee_id"] != issue.assignee_id:
            new_assignee = changes["assignee_id"]
            await self._check_assignee(issue.workspace_id, new_assignee)
            values["assignee_id"] = new_assignee
            new_user = None
            if new_assignee is not None:
                subscribers.add(new_assignee)
                new_user = await self.repo.get_user(new_assignee)
            log(
                "assignee", self._user_label(issue.assignee), self._user_label(new_user)
            )

        if "label_ids" in changes:
            new_ids = set(changes["label_ids"])
            old_ids = {label.id for label in issue.labels}
            if new_ids != old_ids:
                new_labels = await self._labels(issue.workspace_id, new_ids)
                label_ids = new_ids
                log(
                    "labels",
                    ", ".join(label.name for label in issue.labels) or None,
                    ", ".join(sorted(label.name for label in new_labels)) or None,
                )

        if "project_id" in changes and changes["project_id"] != issue.project_id:
            new_name = await self._project_name(
                issue.workspace_id, changes["project_id"]
            )
            old_name = await self._project_name(issue.workspace_id, issue.project_id)
            values["project_id"] = changes["project_id"]
            log("project", old_name, new_name)

        if "cycle_id" in changes and changes["cycle_id"] != issue.cycle_id:
            new_name = await self._cycle_name(issue.team_id, changes["cycle_id"])
            old_name = await self._cycle_name(issue.team_id, issue.cycle_id)
            values["cycle_id"] = changes["cycle_id"]
            log("cycle", old_name, new_name)

        if "parent_id" in changes and changes["parent_id"] != issue.parent_id:
            new_parent = await self._parent_identifier(
                issue.workspace_id, changes["parent_id"], issue.id
            )
            old_parent = await self._parent_identifier(
                issue.workspace_id, issue.parent_id
            )
            values["parent_id"] = changes["parent_id"]
            log("parent", old_parent, new_parent)
            # The old and the new parent log the sub-issue too.
            if issue.parent_id is not None:
                activities.append(
                    _change(
                        user_id,
                        "sub_issue",
                        issue.identifier,
                        None,
                        issue_id=issue.parent_id,
                    )
                )
            if changes["parent_id"] is not None:
                activities.append(
                    _change(
                        user_id,
                        "sub_issue",
                        None,
                        issue.identifier,
                        issue_id=changes["parent_id"],
                    )
                )

        if "archived" in changes and changes["archived"] != (
            issue.archived_at is not None
        ):
            archived = changes["archived"]
            values["archived_at"] = now if archived else None
            activities.append(
                {
                    "actor_id": user_id,
                    "action": IssueActivityAction.archived
                    if archived
                    else IssueActivityAction.unarchived,
                }
            )

        if not values and label_ids is None:
            return None
        values["updated_at"] = now
        return {
            "values": values,
            "label_ids": label_ids,
            "subscriber_ids": subscribers,
            "activities": activities,
        }

    async def delete_issue(self, issue_id: uuid.UUID, *, user_id: uuid.UUID) -> None:
        issue = await self.get_for_member(issue_id, user_id=user_id)
        await self.repo.delete_many(
            [issue.id],
            activities=await self._deletion_activities([issue], user_id=user_id),
        )
        self._log_entity(issue_id)

    async def _deletion_activities(
        self, issues: list[Issue], *, user_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        """The rows the issues that stay get when these issues are deleted.

        Their sub-issues lose the parent, their parent loses the sub-issue and
        every related issue loses the relation, like the explicit changes do.
        """
        deleted = {issue.id: issue for issue in issues}
        rows: list[dict[str, Any]] = []
        for issue in issues:
            if issue.parent_id is not None and issue.parent_id not in deleted:
                rows.append(
                    _change(
                        user_id,
                        "sub_issue",
                        issue.identifier,
                        None,
                        issue_id=issue.parent_id,
                    )
                )
        for child in await self.repo.children_of(list(deleted)):
            if child.parent_id is None:
                continue
            parent = deleted[child.parent_id]
            rows.append(
                _change(user_id, "parent", parent.identifier, None, issue_id=child.id)
            )
        for relation in await self.repo.relations_of(list(deleted)):
            source_field, target_field = RELATION_FIELDS[relation.type]
            if relation.issue_id not in deleted:
                rows.append(
                    _change(
                        user_id,
                        source_field,
                        relation.related_issue.identifier,
                        None,
                        issue_id=relation.issue_id,
                    )
                )
            elif relation.related_issue_id not in deleted:
                rows.append(
                    _change(
                        user_id,
                        target_field,
                        relation.issue.identifier,
                        None,
                        issue_id=relation.related_issue_id,
                    )
                )
        return rows

    # --- bulk --------------------------------------------------------------

    async def _issues_for_member(
        self, issue_ids: list[uuid.UUID], *, user_id: uuid.UUID
    ) -> list[Issue]:
        """Load every issue, in the given order; 404 if one is missing or hidden."""
        wanted = list(dict.fromkeys(issue_ids))
        issues = {issue.id: issue for issue in await self.repo.get_many_full(wanted)}
        for issue_id in wanted:
            if issue_id not in issues:
                raise NotFoundError(detail=f"Issue {issue_id} not found")
        for workspace_id in {issue.workspace_id for issue in issues.values()}:
            try:
                await self.workspace_service.require_member(workspace_id, user_id)
            except NotFoundError as err:
                hidden = next(
                    i.id for i in issues.values() if i.workspace_id == workspace_id
                )
                raise NotFoundError(detail=f"Issue {hidden} not found") from err
        return [issues[issue_id] for issue_id in wanted]

    async def bulk_update(
        self, data: IssueBulkUpdate, *, user_id: uuid.UUID
    ) -> list[Issue]:
        """Apply the same changes to many issues: all or nothing, one commit."""
        issues = await self._issues_for_member(data.issue_ids, user_id=user_id)
        base = data.update.model_dump(
            exclude_unset=True, exclude={"label_ids_add", "label_ids_remove"}
        )
        add = set(data.update.label_ids_add or [])
        remove = set(data.update.label_ids_remove or [])
        plans: list[dict[str, Any]] = []
        for issue in issues:
            changes = dict(base)
            if add or remove:
                current = set(
                    changes.get("label_ids") or [lb.id for lb in issue.labels]
                )
                changes["label_ids"] = list((current | add) - remove)
            plan = await self._plan_update(issue, changes, user_id=user_id)
            if plan is not None:
                plans.append({"issue_id": issue.id, **plan})
        if plans:
            await self.repo.update_issues(plans)
            by_id = {issue.id: issue for issue in issues}
            for plan in plans:
                await self._notify_update(
                    by_id[plan["issue_id"]], plan["values"], user_id=user_id
                )
        log_entities("issue", [issue.id for issue in issues])
        return await self.repo.get_many_full([issue.id for issue in issues])

    async def bulk_delete(
        self, issue_ids: list[uuid.UUID], *, user_id: uuid.UUID
    ) -> None:
        issues = await self._issues_for_member(issue_ids, user_id=user_id)
        await self.repo.delete_many(
            [issue.id for issue in issues],
            activities=await self._deletion_activities(issues, user_id=user_id),
        )
        log_entities("issue", [issue.id for issue in issues])
