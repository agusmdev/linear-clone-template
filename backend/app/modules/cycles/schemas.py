"""Cycle schemas - request and response models."""

import enum
import uuid
from datetime import date, datetime
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, Field

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel


def blank_to_none(value: Any) -> Any:
    """Trim a name; a blank one becomes ``None`` (the cycle is "Cycle <number>")."""
    if not isinstance(value, str):
        return value
    return value.strip() or None


# Ends trimmed; blank = no custom name.
CycleName = Annotated[str | None, BeforeValidator(blank_to_none)]


class CycleStatus(enum.StrEnum):
    current = "current"
    upcoming = "upcoming"
    past = "past"


class CycleBase(BaseModel):
    name: CycleName = Field(default=None, max_length=255)
    starts_at: date
    ends_at: date


class CycleCreate(CycleBase):
    pass


@partial_model
class CycleUpdate(CycleBase):
    pass


class CycleScope(OrmBaseModel):
    """Non-archived issues of the cycle, by workflow state type."""

    backlog: int = 0
    unstarted: int = 0
    started: int = 0
    completed: int = 0
    canceled: int = 0


class CycleProgress(OrmBaseModel):
    """``total`` = scope without canceled issues; ``percentage`` = completed / total."""

    total: int
    completed: int
    percentage: int
    scope: CycleScope


class CycleResponse(OrmBaseModel):
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


class CycleCompleteRequest(BaseModel):
    """``target_cycle_id`` default: the next cycle of the team (by start date)."""

    target_cycle_id: uuid.UUID | None = None


class CycleCompleteResponse(OrmBaseModel):
    moved: int
    target_cycle: CycleResponse
