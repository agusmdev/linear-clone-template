"""Workspace schemas - request and response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.database.mixins import OrmBaseModel
from app.modules.workspaces.models import WorkspaceRole
from app.user.schemas import UserSummary

URL_KEY_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
TEAM_KEY_PATTERN = r"^[A-Z]{2,5}$"


class WorkspaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    # Lowercase letters, digits and single dashes: the slug of the app URL.
    url_key: str = Field(..., min_length=2, max_length=48, pattern=URL_KEY_PATTERN)


class WorkspaceCreate(WorkspaceBase):
    """Create a workspace with its first team (default "Engineering" / "ENG")."""

    team_name: str | None = Field(None, min_length=1, max_length=255)
    team_key: str | None = Field(None, pattern=TEAM_KEY_PATTERN)


class WorkspaceResponse(WorkspaceBase, OrmBaseModel):
    id: uuid.UUID
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberResponse(OrmBaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: WorkspaceRole
    created_at: datetime
    user: UserSummary
