"""Repositories of the issue detail resources: comments, relations, activity,
subscribers and sub-issues."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import delete, insert, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload

from app.modules.issues.models import (
    Comment,
    Issue,
    IssueActivity,
    IssueActivityAction,
    IssueRelation,
    IssueRelationType,
    IssueSubscriber,
)
from app.modules.issues.repository import LOAD_OPTIONS
from app.modules.notifications.models import Notification, NotificationType
from app.repositories.exceptions import NotFoundError
from app.repositories.sql_repository import SQLAlchemyRepository
from app.user.models import User


class CommentRepository(SQLAlchemyRepository[Comment]):
    model = Comment

    async def get_with_user(self, comment_id: uuid.UUID) -> Comment | None:
        query = (
            select(Comment)
            .options(selectinload(Comment.user))
            .where(Comment.id == comment_id)
            .execution_options(populate_existing=True)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def _get_with_user_or_404(self, comment_id: uuid.UUID) -> Comment:
        comment = await self.get_with_user(comment_id)
        if comment is None:
            raise NotFoundError(detail=f"Comment {comment_id} not found")
        return comment

    async def list_for_issue(self, issue_id: uuid.UUID) -> Sequence[Comment]:
        query = (
            select(Comment)
            .options(selectinload(Comment.user))
            .where(Comment.issue_id == issue_id)
            .order_by(Comment.created_at, Comment.id)
        )
        return (await self._session.execute(query)).scalars().all()

    @SQLAlchemyRepository.translate_commit_errors
    async def create_comment(
        self,
        *,
        issue_id: uuid.UUID,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        body: str,
    ) -> Comment:
        """Insert the comment, subscribe the author, log the activity and
        notify every other subscriber: one commit."""
        comment_id = (
            await self._session.execute(
                insert(Comment)
                .values(issue_id=issue_id, user_id=user_id, body=body)
                .returning(Comment.id)
            )
        ).scalar_one()
        await self._session.execute(
            pg_insert(IssueSubscriber)
            .values(issue_id=issue_id, user_id=user_id)
            .on_conflict_do_nothing(index_elements=["issue_id", "user_id"])
        )
        await self._session.execute(
            insert(IssueActivity).values(
                issue_id=issue_id, actor_id=user_id, action="commented"
            )
        )
        recipients = (
            (
                await self._session.execute(
                    select(IssueSubscriber.user_id).where(
                        IssueSubscriber.issue_id == issue_id,
                        IssueSubscriber.user_id != user_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        if recipients:
            await self._session.execute(
                insert(Notification),
                [
                    {
                        "user_id": recipient,
                        "workspace_id": workspace_id,
                        "issue_id": issue_id,
                        "actor_id": user_id,
                        "type": NotificationType.commented,
                    }
                    for recipient in recipients
                ],
            )
        await self._session.commit()
        return await self._get_with_user_or_404(comment_id)

    @SQLAlchemyRepository.translate_commit_errors
    async def update_body(
        self, comment_id: uuid.UUID, body: str, edited_at: datetime
    ) -> Comment:
        await self._session.execute(
            update(Comment)
            .where(Comment.id == comment_id)
            .values(body=body, edited_at=edited_at, updated_at=edited_at)
        )
        await self._session.commit()
        return await self._get_with_user_or_404(comment_id)


def _issue_ref_options(attribute: Any) -> Any:
    return selectinload(attribute).options(
        selectinload(Issue.team), selectinload(Issue.state)
    )


class IssueRelationRepository(SQLAlchemyRepository[IssueRelation]):
    model = IssueRelation

    def _select(self) -> Any:
        return select(IssueRelation).options(
            _issue_ref_options(IssueRelation.issue),
            _issue_ref_options(IssueRelation.related_issue),
        )

    async def get_full(self, relation_id: uuid.UUID) -> IssueRelation | None:
        query = self._select().where(IssueRelation.id == relation_id)
        return (await self._session.execute(query)).scalar_one_or_none()

    async def list_for_issue(self, issue_id: uuid.UUID) -> Sequence[IssueRelation]:
        query = (
            self._select()
            .where(
                or_(
                    IssueRelation.issue_id == issue_id,
                    IssueRelation.related_issue_id == issue_id,
                )
            )
            .order_by(IssueRelation.created_at, IssueRelation.id)
        )
        return (await self._session.execute(query)).scalars().all()

    async def exists_between(
        self, a: uuid.UUID, b: uuid.UUID, relation_type: IssueRelationType
    ) -> bool:
        """True when ``a`` and ``b`` already have a relation of this type
        (either direction)."""
        query = select(IssueRelation.id).where(
            IssueRelation.type == relation_type,
            or_(
                (IssueRelation.issue_id == a) & (IssueRelation.related_issue_id == b),
                (IssueRelation.issue_id == b) & (IssueRelation.related_issue_id == a),
            ),
        )
        return (await self._session.execute(query)).first() is not None

    @SQLAlchemyRepository.translate_commit_errors
    async def create_relation(
        self,
        issue_id: uuid.UUID,
        related_issue_id: uuid.UUID,
        relation_type: IssueRelationType,
        *,
        activities: list[dict[str, Any]],
    ) -> IssueRelation:
        """Insert the relation and its activity rows: one commit."""
        relation_id = (
            await self._session.execute(
                insert(IssueRelation)
                .values(
                    issue_id=issue_id,
                    related_issue_id=related_issue_id,
                    type=relation_type,
                )
                .returning(IssueRelation.id)
            )
        ).scalar_one()
        if activities:
            await self._session.execute(insert(IssueActivity), activities)
        await self._session.commit()
        relation = await self.get_full(relation_id)
        if relation is None:
            raise NotFoundError(detail=f"Relation {relation_id} not found")
        return relation

    @SQLAlchemyRepository.translate_commit_errors
    async def delete_relation(
        self, relation_id: uuid.UUID, *, activities: list[dict[str, Any]]
    ) -> None:
        """Delete the relation and log its activity rows: one commit."""
        if activities:
            await self._session.execute(insert(IssueActivity), activities)
        await self._session.execute(
            delete(IssueRelation).where(IssueRelation.id == relation_id)
        )
        await self._session.commit()


class IssueSubscriberRepository(SQLAlchemyRepository[IssueSubscriber]):
    model = IssueSubscriber

    async def list_users(self, issue_id: uuid.UUID) -> Sequence[User]:
        query = (
            select(User)
            .join(IssueSubscriber, IssueSubscriber.user_id == User.id)
            .where(IssueSubscriber.issue_id == issue_id)
            .order_by(User.display_name, User.email)
        )
        return (await self._session.execute(query)).scalars().all()

    @SQLAlchemyRepository.translate_commit_errors
    async def subscribe(self, issue_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self._session.execute(
            pg_insert(IssueSubscriber)
            .values(issue_id=issue_id, user_id=user_id)
            .on_conflict_do_nothing(index_elements=["issue_id", "user_id"])
        )
        await self._session.commit()

    @SQLAlchemyRepository.translate_commit_errors
    async def unsubscribe(self, issue_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self._session.execute(
            delete(IssueSubscriber).where(
                IssueSubscriber.issue_id == issue_id,
                IssueSubscriber.user_id == user_id,
            )
        )
        await self._session.commit()


class IssueActivityRepository(SQLAlchemyRepository[IssueActivity]):
    model = IssueActivity

    async def list_for_issue(self, issue_id: uuid.UUID) -> Sequence[IssueActivity]:
        query = (
            select(IssueActivity)
            .options(selectinload(IssueActivity.actor))
            .where(IssueActivity.issue_id == issue_id)
            # Rows of one write share created_at: "created" comes first.
            .order_by(
                IssueActivity.created_at,
                IssueActivity.action != IssueActivityAction.created,
                IssueActivity.id,
            )
        )
        return (await self._session.execute(query)).scalars().all()


class SubIssueRepository(SQLAlchemyRepository[Issue]):
    model = Issue

    async def list_children(self, parent_id: uuid.UUID) -> Sequence[Issue]:
        """Sub-issues that are not archived, in manual order."""
        query = (
            select(Issue)
            .options(*LOAD_OPTIONS)
            .where(Issue.parent_id == parent_id, Issue.archived_at.is_(None))
            .order_by(Issue.sort_order, Issue.number)
        )
        return (await self._session.execute(query)).scalars().all()
