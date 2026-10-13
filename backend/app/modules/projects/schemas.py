"""Project schemas - request and response models."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel
from app.modules.projects.models import ProjectStatus
from app.modules.teams.schemas import TeamSummary
from app.user.schemas import UserSummary

NAME_MAX = 255
DESCRIPTION_MAX = 200_000
TEAMS_MAX = 50

# Ends trimmed; a blank name is a 422.
ProjectName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX)
]


class ProjectBase(BaseModel):
    name: ProjectName
    # HTML from the TipTap editor.
    description: str | None = Field(None, max_length=DESCRIPTION_MAX)
    status: ProjectStatus = ProjectStatus.planned
    lead_id: uuid.UUID | None = None
    start_date: date | None = None
    target_date: date | None = None
    color: str | None = Field(None, max_length=32)
    icon: str | None = Field(None, max_length=64)
    # The teams that work on the project (teams of the same workspace).
    team_ids: list[uuid.UUID] = Field(default_factory=list, max_length=TEAMS_MAX)


class ProjectCreate(ProjectBase):
    workspace_id: uuid.UUID


class ProjectUpdateFields(ProjectBase):
    sort_order: float = Field(0, allow_inf_nan=False)


@partial_model
class ProjectUpdate(ProjectUpdateFields):
    """PATCH: only the sent fields change; ``team_ids`` replaces the teams."""

    pass


class ProjectProgress(BaseModel):
    """Issue progress: canceled and archived issues are not counted."""

    total: int
    completed: int
    # 0-100, rounded down.
    percentage: int


class ProjectResponse(OrmBaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str | None
    status: ProjectStatus
    lead_id: uuid.UUID | None
    lead: UserSummary | None
    start_date: date | None
    target_date: date | None
    color: str | None
    icon: str | None
    sort_order: float
    team_ids: list[uuid.UUID]
    teams: list[TeamSummary]
    issue_count: int
    completed_issue_count: int
    progress: ProjectProgress
    created_at: datetime
    updated_at: datetime
