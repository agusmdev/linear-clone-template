"""Cycle repository - database access layer."""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import func, insert, select, update

from app.modules.cycles.models import Cycle
from app.modules.issues.models import Issue, IssueActivity, IssueActivityAction
from app.modules.teams.models import WorkflowState, WorkflowStateType
from app.repositories.sql_repository import SQLAlchemyRepository

UNFINISHED_TYPES = (
    WorkflowStateType.backlog,
    WorkflowStateType.unstarted,
    WorkflowStateType.started,
)


class CycleRepository(SQLAlchemyRepository[Cycle]):
    model = Cycle

    async def list_for_team(self, team_id: uuid.UUID) -> list[Cycle]:
        query = (
            select(Cycle)
            .where(Cycle.team_id == team_id)
            .order_by(Cycle.starts_at, Cycle.number)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def next_number(self, team_id: uuid.UUID) -> int:
        query = select(func.coalesce(func.max(Cycle.number), 0)).where(
            Cycle.team_id == team_id
        )
        return int((await self._session.execute(query)).scalar_one()) + 1

    async def overlapping(
        self,
        team_id: uuid.UUID,
        starts_at: date,
        ends_at: date,
        exclude_id: uuid.UUID | None = None,
    ) -> Cycle | None:
        """The first cycle of the team whose (inclusive) dates overlap these."""
        query = select(Cycle).where(
            Cycle.team_id == team_id,
            Cycle.starts_at <= ends_at,
            Cycle.ends_at >= starts_at,
        )
        if exclude_id is not None:
            query = query.where(Cycle.id != exclude_id)
        query = query.order_by(Cycle.starts_at).limit(1)
        return (await self._session.execute(query)).scalar_one_or_none()

    async def next_after(self, cycle: Cycle) -> Cycle | None:
        """The first cycle of the same team that starts after ``cycle`` ends."""
        query = (
            select(Cycle)
            .where(Cycle.team_id == cycle.team_id, Cycle.starts_at > cycle.ends_at)
            .order_by(Cycle.starts_at)
            .limit(1)
        )
        return (await self._session.execute(query)).scalar_one_or_none()

    async def scope_counts(
        self, cycle_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, dict[str, int]]:
        """Non-archived issue counts per cycle and workflow state type."""
        if not cycle_ids:
            return {}
        query = (
            select(Issue.cycle_id, WorkflowState.type, func.count(Issue.id))
            .join(WorkflowState, WorkflowState.id == Issue.state_id)
            .where(Issue.cycle_id.in_(cycle_ids), Issue.archived_at.is_(None))
            .group_by(Issue.cycle_id, WorkflowState.type)
        )
        counts: dict[uuid.UUID, dict[str, int]] = {}
        for cycle_id, state_type, count in (await self._session.execute(query)).all():
            counts.setdefault(cycle_id, {})[str(state_type)] = int(count)
        return counts

    @SQLAlchemyRepository.translate_commit_errors
    async def move_unfinished_issues(
        self,
        source: Cycle,
        target: Cycle,
        *,
        actor_id: uuid.UUID,
        from_name: str,
        to_name: str,
    ) -> int:
        """Move the unfinished, non-archived issues of ``source`` to ``target``.

        One commit: the issue updates and one history row per moved issue.
        """
        unfinished_states = select(WorkflowState.id).where(
            WorkflowState.type.in_(UNFINISHED_TYPES)
        )
        now = datetime.now(tz=UTC)
        result = await self._session.execute(
            update(Issue)
            .where(
                Issue.cycle_id == source.id,
                Issue.archived_at.is_(None),
                Issue.state_id.in_(unfinished_states),
            )
            .values(cycle_id=target.id, updated_at=now)
            .returning(Issue.id)
        )
        moved_ids = list(result.scalars().all())
        if moved_ids:
            await self._session.execute(
                insert(IssueActivity),
                [
                    {
                        "issue_id": issue_id,
                        "actor_id": actor_id,
                        "action": IssueActivityAction.updated,
                        "field": "cycle",
                        "from_value": from_name,
                        "to_value": to_name,
                    }
                    for issue_id in moved_ids
                ],
            )
        await self._session.commit()
        return len(moved_ids)
