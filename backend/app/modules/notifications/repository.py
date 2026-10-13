"""Notification repository - database access layer."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, insert, select, update
from sqlalchemy.orm import selectinload

from app.modules.issues.models import Issue, IssueSubscriber
from app.modules.notifications.models import Notification
from app.repositories.sql_repository import SQLAlchemyRepository

# The relationships NotificationResponse embeds (never loaded lazily).
LOAD_OPTIONS = (
    selectinload(Notification.issue).selectinload(Issue.team),
    selectinload(Notification.issue).selectinload(Issue.state),
    selectinload(Notification.state),
    selectinload(Notification.comment),
    selectinload(Notification.actor),
)


class NotificationRepository(SQLAlchemyRepository[Notification]):
    model = Notification

    def select_full(self) -> Any:
        """``SELECT notification`` with the embedded issue and actor loaded."""
        return select(Notification).options(*LOAD_OPTIONS)

    async def get_full(self, notification_id: uuid.UUID) -> Notification | None:
        query = (
            self.select_full()
            .where(Notification.id == notification_id)
            .execution_options(populate_existing=True)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def count_unread(self, workspace_id: uuid.UUID, user_id: uuid.UUID) -> int:
        query = select(func.count(Notification.id)).where(
            Notification.workspace_id == workspace_id,
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
            Notification.archived_at.is_(None),
        )
        return int((await self._session.execute(query)).scalar_one())

    @SQLAlchemyRepository.translate_commit_errors
    async def update_values(
        self, notification_id: uuid.UUID, values: dict[str, Any]
    ) -> Notification | None:
        await self._session.execute(
            update(Notification)
            .where(Notification.id == notification_id)
            .values(**values)
        )
        await self._session.commit()
        return await self.get_full(notification_id)

    @SQLAlchemyRepository.translate_commit_errors
    async def mark_all_read(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, now: datetime
    ) -> int:
        result = await self._session.execute(
            update(Notification)
            .where(
                Notification.workspace_id == workspace_id,
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
                # Like the unread count: archived notifications are not in the inbox.
                Notification.archived_at.is_(None),
            )
            .values(read_at=now, updated_at=now)
            .returning(Notification.id)
        )
        updated = len(result.all())
        await self._session.commit()
        return updated

    async def subscriber_ids(self, issue_id: uuid.UUID) -> set[uuid.UUID]:
        query = select(IssueSubscriber.user_id).where(
            IssueSubscriber.issue_id == issue_id
        )
        return set((await self._session.execute(query)).scalars().all())

    @SQLAlchemyRepository.translate_commit_errors
    async def insert_rows(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        await self._session.execute(insert(Notification), rows)
        await self._session.commit()
