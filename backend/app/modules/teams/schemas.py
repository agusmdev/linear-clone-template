"""Team and workflow state schemas - response models."""

import uuid
from datetime import datetime

from app.database.mixins import OrmBaseModel
from app.modules.teams.models import WorkflowStateType


class TeamSummary(OrmBaseModel):
    """A team embedded in other responses."""

    id: uuid.UUID
    key: str
    name: str


class TeamResponse(TeamSummary):
    workspace_id: uuid.UUID
    description: str | None
    color: str | None
    icon: str | None
    created_at: datetime
    updated_at: datetime


class WorkflowStateSummary(OrmBaseModel):
    """A workflow state embedded in other responses."""

    id: uuid.UUID
    name: str
    type: WorkflowStateType
    color: str


class WorkflowStateResponse(WorkflowStateSummary):
    team_id: uuid.UUID
    position: float
    created_at: datetime
    updated_at: datetime
