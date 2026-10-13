"""Services of the issue detail resources: comments, relations, activity,
subscribers and sub-issues.

Every method first loads the issue through ``IssueService.get_for_member``,
so a user who is not a member of the issue's workspace gets the 404 of a
missing issue.
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from app.modules.issues.detail_repository import (
    CommentRepository,
    IssueActivityRepository,
    IssueRelationRepository,
    IssueSubscriberRepository,
    SubIssueRepository,
)
from app.modules.issues.detail_schemas import (
    CommentCreate,
    CommentUpdate,
    IssueRef,
    IssueRelationCreate,
    IssueRelationCreateType,
    IssueRelationDirection,
    IssueRelationResponse,
    SubIssuesResponse,
)
from app.modules.issues.models import (
    Comment,
    Issue,
    IssueActivity,
    IssueActivityAction,
    IssueRelation,
    IssueRelationType,
    IssueSubscriber,
)
from app.modules.issues.schemas import IssueResponse
from app.modules.issues.service import IssueService
from app.modules.teams.models import WorkflowStateType
from app.modules.workspaces.exceptions import InvalidReferenceError
from app.repositories.exceptions import DuplicateError, NotFoundError
from app.services.base_crud_service import BaseService
from app.user.models import User


class CommentService(BaseService[Comment]):
    def __init__(self, repo: CommentRepository, issue_service: IssueService) -> None:
        self.repo = repo
        self.issue_service = issue_service

    async def list_comments(
        self, issue_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> Sequence[Comment]:
        await self.issue_service.get_for_member(issue_id, user_id=user_id)
        return await self.repo.list_for_issue(issue_id)

    async def create_comment(
        self, issue_id: uuid.UUID, data: CommentCreate, *, user_id: uuid.UUID
    ) -> Comment:
        issue = await self.issue_service.get_for_member(issue_id, user_id=user_id)
        comment = await self.repo.create_comment(
            issue_id=issue.id,
            workspace_id=issue.workspace_id,
            user_id=user_id,
            body=data.body,
        )
        self._log_entity(comment.id)
        return comment

    async def _own_comment(self, comment_id: uuid.UUID, user_id: uuid.UUID) -> Comment:
        """The comment, when the user wrote it and is still a member; else 404."""
        comment = await self.repo.get_with_user(comment_id)
        detail = f"Comment {comment_id} not found"
        if comment is None or comment.user_id != user_id:
            raise NotFoundError(detail=detail)
        try:
            await self.issue_service.get_for_member(comment.issue_id, user_id=user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        self._log_entity(comment.id)
        return comment

    async def update_comment(
        self, comment_id: uuid.UUID, data: CommentUpdate, *, user_id: uuid.UUID
    ) -> Comment:
        comment = await self._own_comment(comment_id, user_id)
        if data.body == comment.body:
            return comment
        return await self.repo.update_body(comment.id, data.body, datetime.now(tz=UTC))

    async def delete_comment(
        self, comment_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        comment = await self._own_comment(comment_id, user_id)
        await self.repo.delete(comment.id)


# Activity field of a relation, as seen from (source, target) of the stored row.
_RELATION_FIELDS: dict[IssueRelationType, tuple[str, str]] = {
    IssueRelationType.blocks: ("relation_blocks", "relation_blocked_by"),
    IssueRelationType.related: ("relation_related", "relation_related"),
    IssueRelationType.duplicate: ("relation_duplicate_of", "relation_duplicated_by"),
}


def relation_activities(
    source: Issue,
    target: Issue,
    relation_type: IssueRelationType,
    *,
    actor_id: uuid.UUID,
    added: bool,
) -> list[dict[str, Any]]:
    """One activity row on each issue of a relation that was added or removed.

    The value is the other issue's identifier: ``to_value`` when added,
    ``from_value`` when removed.
    """
    source_field, target_field = _RELATION_FIELDS[relation_type]
    key = "to_value" if added else "from_value"
    return [
        {
            "issue_id": issue.id,
            "actor_id": actor_id,
            "action": IssueActivityAction.updated,
            "field": field,
            key: other.identifier,
        }
        for issue, field, other in (
            (source, source_field, target),
            (target, target_field, source),
        )
    ]


class IssueRelationService(BaseService[IssueRelation]):
    def __init__(
        self, repo: IssueRelationRepository, issue_service: IssueService
    ) -> None:
        self.repo = repo
        self.issue_service = issue_service

    @staticmethod
    def to_response(
        relation: IssueRelation, issue_id: uuid.UUID
    ) -> IssueRelationResponse:
        """The relation as seen from ``issue_id``."""
        outgoing = relation.issue_id == issue_id
        other: Issue = relation.related_issue if outgoing else relation.issue
        return IssueRelationResponse(
            id=relation.id,
            type=relation.type,
            direction=(
                IssueRelationDirection.outgoing
                if outgoing
                else IssueRelationDirection.incoming
            ),
            issue=IssueRef.model_validate(other),
            created_at=relation.created_at,
        )

    async def list_relations(
        self, issue_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[IssueRelationResponse]:
        await self.issue_service.get_for_member(issue_id, user_id=user_id)
        relations = await self.repo.list_for_issue(issue_id)
        return [self.to_response(relation, issue_id) for relation in relations]

    async def create_relation(
        self, issue_id: uuid.UUID, data: IssueRelationCreate, *, user_id: uuid.UUID
    ) -> IssueRelationResponse:
        issue = await self.issue_service.get_for_member(issue_id, user_id=user_id)
        other = await self.issue_service.repo.get_full(data.related_issue_id)
        if other is None or other.workspace_id != issue.workspace_id:
            raise InvalidReferenceError(
                detail=f"Issue {data.related_issue_id} is not in this workspace"
            )
        if other.id == issue.id:
            raise InvalidReferenceError(detail="An issue cannot relate to itself")

        source, target = issue, other
        if data.type == IssueRelationCreateType.blocked_by:
            source, target = other, issue
            relation_type = IssueRelationType.blocks
        else:
            relation_type = IssueRelationType(data.type.value)

        # Checked both ways: "B blocks A" next to "A blocks B" makes no sense.
        if await self.repo.exists_between(source.id, target.id, relation_type):
            raise DuplicateError(detail="These issues already have this relation")
        relation = await self.repo.create_relation(
            source.id,
            target.id,
            relation_type,
            activities=relation_activities(
                source, target, relation_type, actor_id=user_id, added=True
            ),
        )
        self._log_entity(relation.id)
        return self.to_response(relation, issue.id)

    async def delete_relation(
        self, relation_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        relation = await self.repo.get_full(relation_id)
        detail = f"Relation {relation_id} not found"
        if relation is None:
            raise NotFoundError(detail=detail)
        try:
            await self.issue_service.get_for_member(relation.issue_id, user_id=user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        await self.repo.delete_relation(
            relation.id,
            activities=relation_activities(
                relation.issue,
                relation.related_issue,
                relation.type,
                actor_id=user_id,
                added=False,
            ),
        )
        self._log_entity(relation.id)


class IssueSubscriberService(BaseService[IssueSubscriber]):
    def __init__(
        self, repo: IssueSubscriberRepository, issue_service: IssueService
    ) -> None:
        self.repo = repo
        self.issue_service = issue_service

    async def list_subscribers(
        self, issue_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> Sequence[User]:
        await self.issue_service.get_for_member(issue_id, user_id=user_id)
        return await self.repo.list_users(issue_id)

    async def subscribe(
        self,
        issue_id: uuid.UUID,
        subscriber_id: uuid.UUID | None,
        *,
        user_id: uuid.UUID,
    ) -> None:
        issue = await self.issue_service.get_for_member(issue_id, user_id=user_id)
        target = subscriber_id or user_id
        if (
            target != user_id
            and not await self.issue_service.workspace_service.are_members(
                issue.workspace_id, {target}
            )
        ):
            raise InvalidReferenceError(
                detail=f"User {target} is not a member of this workspace"
            )
        await self.repo.subscribe(issue.id, target)

    async def unsubscribe(
        self, issue_id: uuid.UUID, subscriber_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        issue = await self.issue_service.get_for_member(issue_id, user_id=user_id)
        await self.repo.unsubscribe(issue.id, subscriber_id)


class IssueActivityService(BaseService[IssueActivity]):
    def __init__(
        self, repo: IssueActivityRepository, issue_service: IssueService
    ) -> None:
        self.repo = repo
        self.issue_service = issue_service

    async def list_activity(
        self, issue_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> Sequence[IssueActivity]:
        await self.issue_service.get_for_member(issue_id, user_id=user_id)
        return await self.repo.list_for_issue(issue_id)


class SubIssueService(BaseService[Issue]):
    def __init__(self, repo: SubIssueRepository, issue_service: IssueService) -> None:
        self.repo = repo
        self.issue_service = issue_service

    async def list_sub_issues(
        self, issue_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> SubIssuesResponse:
        await self.issue_service.get_for_member(issue_id, user_id=user_id)
        children = await self.repo.list_children(issue_id)
        return SubIssuesResponse(
            items=[IssueResponse.model_validate(child) for child in children],
            total=len(children),
            completed=sum(
                1
                for child in children
                if child.state.type == WorkflowStateType.completed
            ),
        )
