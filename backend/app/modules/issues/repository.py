"""Issue repository - database access layer."""

import uuid
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload

from app.modules.cycles.models import Cycle
from app.modules.issues.models import (
    Issue,
    IssueActivity,
    IssueLabel,
    IssueSubscriber,
)
from app.modules.projects.models import Project
from app.modules.teams.models import Team
from app.repositories.exceptions import NotFoundError
from app.repositories.sql_repository import SQLAlchemyRepository
from app.user.models import User

# The relationships IssueResponse embeds. Every query that returns issues to
# the API uses them (the relationships never load lazily).
LOAD_OPTIONS = (
    selectinload(Issue.team),
    selectinload(Issue.state),
    selectinload(Issue.assignee),
    selectinload(Issue.creator),
    selectinload(Issue.labels),
)


class IssueRepository(SQLAlchemyRepository[Issue]):
    model = Issue

    def select_full(self) -> Any:
        """``SELECT issue`` with the embedded relationships loaded."""
        return select(Issue).options(*LOAD_OPTIONS)

    async def get_full(self, issue_id: uuid.UUID) -> Issue | None:
        query = (
            self.select_full()
            .where(Issue.id == issue_id)
            .execution_options(populate_existing=True)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def _get_full_or_404(self, issue_id: uuid.UUID) -> Issue:
        issue = await self.get_full(issue_id)
        if issue is None:
            raise NotFoundError(detail=f"Issue {issue_id} not found")
        return issue

    async def get_by_number(self, team_id: uuid.UUID, number: int) -> Issue | None:
        query = self.select_full().where(
            Issue.team_id == team_id, Issue.number == number
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def next_sort_order(self, team_id: uuid.UUID) -> float:
        query = select(func.max(Issue.sort_order)).where(Issue.team_id == team_id)
        current = (await self._session.execute(query)).scalar_one_or_none()
        return (current or 0.0) + 1.0

    async def parent_id_of(self, issue_id: uuid.UUID) -> uuid.UUID | None:
        query = select(Issue.parent_id).where(Issue.id == issue_id)
        return (await self._session.execute(query)).scalar_one_or_none()

    async def get_project(self, project_id: uuid.UUID) -> Project | None:
        return await self._session.get(Project, project_id)

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_cycle(self, cycle_id: uuid.UUID) -> Cycle | None:
        return await self._session.get(Cycle, cycle_id)

    async def _add_subscribers(
        self, issue_id: uuid.UUID, user_ids: set[uuid.UUID]
    ) -> None:
        if not user_ids:
            return
        await self._session.execute(
            pg_insert(IssueSubscriber)
            .values([{"issue_id": issue_id, "user_id": uid} for uid in user_ids])
            .on_conflict_do_nothing(index_elements=["issue_id", "user_id"])
        )

    async def _add_activities(
        self, issue_id: uuid.UUID, activities: list[dict[str, Any]]
    ) -> None:
        """Insert activity rows on ``issue_id``, or on the row's own ``issue_id``
        (e.g. the parent of a new sub-issue)."""
        if activities:
            await self._session.execute(
                insert(IssueActivity),
                [{"issue_id": issue_id, **activity} for activity in activities],
            )

    @SQLAlchemyRepository.translate_commit_errors
    async def add_activities(self, activities: list[dict[str, Any]]) -> None:
        """Insert activity rows that each name their ``issue_id``: one commit."""
        if activities:
            await self._session.execute(insert(IssueActivity), activities)
            await self._session.commit()

    async def children_of(self, issue_ids: list[uuid.UUID]) -> list[Issue]:
        """The sub-issues of these issues, with their embedded relationships."""
        if not issue_ids:
            return []
        query = self.select_full().where(Issue.parent_id.in_(issue_ids))
        return list((await self._session.execute(query)).scalars())

    @SQLAlchemyRepository.translate_commit_errors
    async def create_issue(
        self,
        values: dict[str, Any],
        *,
        label_ids: set[uuid.UUID],
        subscriber_ids: set[uuid.UUID],
        activities: list[dict[str, Any]],
    ) -> Issue:
        """Insert an issue with the team's next number, in one commit.

        The ``UPDATE team ... RETURNING issue_counter`` locks the team row
        until the commit, so concurrent creates get distinct numbers.
        """
        number = (
            await self._session.execute(
                update(Team)
                .where(Team.id == values["team_id"])
                .values(issue_counter=Team.issue_counter + 1)
                .returning(Team.issue_counter)
            )
        ).scalar_one()
        issue_id = (
            await self._session.execute(
                insert(Issue).values(**values, number=number).returning(Issue.id)
            )
        ).scalar_one()
        if label_ids:
            await self._session.execute(
                insert(IssueLabel),
                [{"issue_id": issue_id, "label_id": lid} for lid in label_ids],
            )
        await self._add_subscribers(issue_id, subscriber_ids)
        await self._add_activities(issue_id, activities)
        await self._session.commit()
        return await self._get_full_or_404(issue_id)

    @SQLAlchemyRepository.translate_commit_errors
    async def update_issue(
        self,
        issue_id: uuid.UUID,
        values: dict[str, Any],
        *,
        label_ids: set[uuid.UUID] | None,
        subscriber_ids: set[uuid.UUID],
        activities: list[dict[str, Any]],
    ) -> Issue:
        """Update columns, replace labels (when given), log activity: one commit."""
        await self._apply_update(
            issue_id,
            values,
            label_ids=label_ids,
            subscriber_ids=subscriber_ids,
            activities=activities,
        )
        await self._session.commit()
        return await self._get_full_or_404(issue_id)

    @SQLAlchemyRepository.translate_commit_errors
    async def update_issues(self, plans: list[dict[str, Any]]) -> None:
        """Run many ``update_issue`` writes (``issue_id`` + its kwargs) in one commit."""
        for plan in plans:
            await self._apply_update(
                plan["issue_id"],
                plan["values"],
                label_ids=plan["label_ids"],
                subscriber_ids=plan["subscriber_ids"],
                activities=plan["activities"],
            )
        await self._session.commit()

    async def get_many_full(self, issue_ids: list[uuid.UUID]) -> list[Issue]:
        """The issues with these ids (missing ids are left out), in the given order."""
        if not issue_ids:
            return []
        query = (
            self.select_full()
            .where(Issue.id.in_(issue_ids))
            .execution_options(populate_existing=True)
        )
        found = {i.id: i for i in (await self._session.execute(query)).scalars()}
        return [found[issue_id] for issue_id in issue_ids if issue_id in found]

    @SQLAlchemyRepository.translate_commit_errors
    async def delete_many(
        self,
        issue_ids: list[uuid.UUID],
        *,
        activities: list[dict[str, Any]] | None = None,
    ) -> None:
        """Delete the issues and log ``activities`` (on other issues): one commit."""
        if activities:
            await self._session.execute(insert(IssueActivity), activities)
        await self._session.execute(delete(Issue).where(Issue.id.in_(issue_ids)))
        await self._session.commit()

    async def _apply_update(
        self,
        issue_id: uuid.UUID,
        values: dict[str, Any],
        *,
        label_ids: set[uuid.UUID] | None,
        subscriber_ids: set[uuid.UUID],
        activities: list[dict[str, Any]],
    ) -> None:
        if values:
            await self._session.execute(
                update(Issue).where(Issue.id == issue_id).values(**values)
            )
        if label_ids is not None:
            await self._session.execute(
                delete(IssueLabel).where(IssueLabel.issue_id == issue_id)
            )
            if label_ids:
                await self._session.execute(
                    insert(IssueLabel),
                    [{"issue_id": issue_id, "label_id": lid} for lid in label_ids],
                )
        await self._add_subscribers(issue_id, subscriber_ids)
        await self._add_activities(issue_id, activities)
