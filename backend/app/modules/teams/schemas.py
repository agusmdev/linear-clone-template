"""Team and workflow state schemas - request and response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel
from app.modules.teams.models import WorkflowStateType
from app.user.schemas import UserSummary

TEAM_KEY_PATTERN = r"^[A-Z]{2,5}$"
# A CSS hex color: "#5e6ad2".
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


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


class TeamFields(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    # 2-5 uppercase letters, unique in the workspace: the issue prefix (ENG-12).
    key: str = Field(..., pattern=TEAM_KEY_PATTERN)
    description: str | None = Field(None, max_length=10_000)
    color: str | None = Field(None, pattern=COLOR_PATTERN)
    icon: str | None = Field(None, max_length=64)


class TeamCreate(TeamFields):
    """Create a team: the creator joins it; it gets the default workflow states."""

    pass


@partial_model
class TeamUpdate(TeamFields):
    """PATCH: a new key changes the identifier of every issue of the team."""

    pass


class TeamMemberResponse(OrmBaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    user: UserSummary


class TeamMemberAdd(BaseModel):
    """Add a workspace member to the team. No ``user_id`` = join (me)."""

    user_id: uuid.UUID | None = None


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


class WorkflowStateFields(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: WorkflowStateType
    color: str = Field(..., pattern=COLOR_PATTERN)
    position: float = Field(..., allow_inf_nan=False)


class WorkflowStateCreate(WorkflowStateFields):
    """Create a state. ``position`` defaults to after the team's last state."""

    position: float | None = Field(None, allow_inf_nan=False)  # type: ignore[assignment]


@partial_model
class WorkflowStateUpdate(WorkflowStateFields):
    pass
