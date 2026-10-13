"""Cycle service - business logic layer.

Access: a cycle belongs to a team; the user must be a member of the team's
workspace (else the 404 of a missing row). Dates are inclusive: a cycle runs
from ``starts_at`` to ``ends_at``, and two cycles of one team never share a day.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from app.modules.cycles.exceptions import (
    CycleOverlapError,
    InvalidCycleDatesError,
    NoNextCycleError,
)
from app.modules.cycles.models import Cycle
from app.modules.cycles.repository import CycleRepository
from app.modules.cycles.schemas import (
    CycleCreate,
    CycleProgress,
    CycleScope,
    CycleStatus,
    CycleUpdate,
)
from app.modules.teams.service import TeamService
from app.modules.workspaces.exceptions import InvalidReferenceError
from app.repositories.exceptions import NotFoundError
from app.services.base_crud_service import BaseService


@dataclass
class CycleDetails:
    """A cycle with its computed status and progress (read by ``CycleResponse``)."""

    id: uuid.UUID
    team_id: uuid.UUID
    number: int
    name: str | None
    starts_at: date
    ends_at: date
    status: CycleStatus
    issue_count: int
    completed_issue_count: int
    progress: CycleProgress
    created_at: datetime
    updated_at: datetime


@dataclass
class CycleCompletion:
    moved: int
    target_cycle: CycleDetails


def today() -> date:
    return datetime.now(tz=UTC).date()


def cycle_status(cycle: Cycle, on: date) -> CycleStatus:
    if cycle.starts_at > on:
        return CycleStatus.upcoming
    if cycle.ends_at < on:
        return CycleStatus.past
    return CycleStatus.current


def cycle_label(cycle: Cycle) -> str:
    return cycle.name or f"Cycle {cycle.number}"


def build_details(cycle: Cycle, counts: dict[str, int], on: date) -> CycleDetails:
    scope = CycleScope(**counts)
    total = scope.backlog + scope.unstarted + scope.started + scope.completed
    percentage = round(scope.completed * 100 / total) if total else 0
    return CycleDetails(
        id=cycle.id,
        team_id=cycle.team_id,
        number=cycle.number,
        name=cycle.name,
        starts_at=cycle.starts_at,
        ends_at=cycle.ends_at,
        status=cycle_status(cycle, on),
        issue_count=total,
        completed_issue_count=scope.completed,
        progress=CycleProgress(
            total=total, completed=scope.completed, percentage=percentage, scope=scope
        ),
        created_at=cycle.created_at,
        updated_at=cycle.updated_at,
    )


class CycleService(BaseService[Cycle]):
    def __init__(self, repo: CycleRepository, team_service: TeamService) -> None:
        self.repo = repo
        self.team_service = team_service

    # --- helpers -------------------------------------------------------------

    async def _get_for_member(self, cycle_id: uuid.UUID, user_id: uuid.UUID) -> Cycle:
        cycle = await self.repo.get(cycle_id, raise_error=False)
        detail = f"Cycle {cycle_id} not found"
        if cycle is None:
            raise NotFoundError(detail=detail)
        try:
            await self.team_service.get_for_member(cycle.team_id, user_id=user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        self._log_entity(cycle.id)
        return cycle

    async def _details(self, cycles: list[Cycle]) -> list[CycleDetails]:
        counts = await self.repo.scope_counts([c.id for c in cycles])
        on = today()
        return [build_details(c, counts.get(c.id, {}), on) for c in cycles]

    async def _check_dates(
        self,
        team_id: uuid.UUID,
        starts_at: date,
        ends_at: date,
        exclude_id: uuid.UUID | None = None,
    ) -> None:
        if ends_at <= starts_at:
            raise InvalidCycleDatesError()
        other = await self.repo.overlapping(team_id, starts_at, ends_at, exclude_id)
        if other is not None:
            raise CycleOverlapError(
                detail=f"The dates overlap {cycle_label(other)} "
                f"({other.starts_at.isoformat()} - {other.ends_at.isoformat()})"
            )

    # --- API -----------------------------------------------------------------

    async def list_cycles(
        self, team_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[CycleDetails]:
        await self.team_service.get_for_member(team_id, user_id=user_id)
        return await self._details(await self.repo.list_for_team(team_id))

    async def get_cycle(
        self, cycle_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> CycleDetails:
        cycle = await self._get_for_member(cycle_id, user_id)
        return (await self._details([cycle]))[0]

    async def create_cycle(
        self, team_id: uuid.UUID, data: CycleCreate, *, user_id: uuid.UUID
    ) -> CycleDetails:
        await self.team_service.get_for_member(team_id, user_id=user_id)
        await self._check_dates(team_id, data.starts_at, data.ends_at)
        number = await self.repo.next_number(team_id)
        cycle = await self.create(data, team_id=team_id, number=number)
        return (await self._details([cycle]))[0]

    async def update_cycle(
        self, cycle_id: uuid.UUID, data: CycleUpdate, *, user_id: uuid.UUID
    ) -> CycleDetails:
        cycle = await self._get_for_member(cycle_id, user_id)
        changes: dict[str, Any] = data.model_dump(exclude_unset=True)
        if not changes:
            return (await self._details([cycle]))[0]
        starts_at = changes.get("starts_at", cycle.starts_at)
        ends_at = changes.get("ends_at", cycle.ends_at)
        if starts_at is None or ends_at is None:
            raise InvalidCycleDatesError(detail="A cycle needs a start and end date")
        if "starts_at" in changes or "ends_at" in changes:
            await self._check_dates(cycle.team_id, starts_at, ends_at, cycle.id)
        updated = await self.repo.update(cycle.id, changes)
        return (await self._details([updated]))[0]

    async def delete_cycle(self, cycle_id: uuid.UUID, *, user_id: uuid.UUID) -> None:
        cycle = await self._get_for_member(cycle_id, user_id)
        # issue.cycle_id is ON DELETE SET NULL: the issues stay.
        await self.repo.delete(cycle.id)

    async def complete_cycle(
        self,
        cycle_id: uuid.UUID,
        target_cycle_id: uuid.UUID | None,
        *,
        user_id: uuid.UUID,
    ) -> CycleCompletion:
        """Move the unfinished issues of a cycle to the next (or given) cycle."""
        cycle = await self._get_for_member(cycle_id, user_id)
        if target_cycle_id is not None:
            target = await self.repo.get(target_cycle_id, raise_error=False)
            if (
                target is None
                or target.team_id != cycle.team_id
                or target.id == cycle.id
            ):
                raise InvalidReferenceError(
                    detail=f"Cycle {target_cycle_id} is not another cycle of this team"
                )
        else:
            target = await self.repo.next_after(cycle)
            if target is None:
                raise NoNextCycleError()
        moved = await self.repo.move_unfinished_issues(
            cycle,
            target,
            actor_id=user_id,
            from_name=cycle_label(cycle),
            to_name=cycle_label(target),
        )
        return CycleCompletion(
            moved=moved, target_cycle=(await self._details([target]))[0]
        )
