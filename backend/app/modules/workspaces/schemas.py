"""Workspace schemas - request and response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel
from app.modules.workspaces.models import WorkspaceRole
from app.user.schemas import NormalizedEmail, UserSummary

URL_KEY_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
TEAM_KEY_PATTERN = r"^[A-Z]{2,5}$"
# The app serves a workspace at /<url_key>, so a key must not be a top-level
# frontend route (or a name kept for one). Keep in sync with the frontend
# RESERVED_URL_KEYS in src/features/workspaces/workspace-schemas.ts.
RESERVED_URL_KEYS = frozenset(
    {
        "api",
        "auth",
        "items",
        "login",
        "logout",
        "oauth",
        "onboarding",
        "register",
        "settings",
        "signup",
    }
)


class WorkspaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    # Lowercase letters, digits and single dashes: the slug of the app URL.
    url_key: str = Field(..., min_length=2, max_length=48, pattern=URL_KEY_PATTERN)


class NotReservedUrlKey(BaseModel):
    """Refuse a new url_key that clashes with an app route (create and update only,
    so a response never fails for a key stored before the rule)."""

    @field_validator("url_key", check_fields=False)
    @classmethod
    def url_key_is_not_reserved(cls, value: str | None) -> str | None:
        if value in RESERVED_URL_KEYS:
            raise ValueError("This URL is reserved")
        return value


class WorkspaceCreate(NotReservedUrlKey, WorkspaceBase):
    """Create a workspace with its first team (default "Engineering" / "ENG")."""

    team_name: str | None = Field(None, min_length=1, max_length=255)
    team_key: str | None = Field(None, pattern=TEAM_KEY_PATTERN)


@partial_model
class WorkspaceUpdate(NotReservedUrlKey, WorkspaceBase):
    """PATCH: rename the workspace or change its URL key (admins only)."""

    pass


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


class MemberInvite(BaseModel):
    """Add an existing user to the workspace by email (no email is sent)."""

    email: NormalizedEmail
    role: WorkspaceRole = WorkspaceRole.member


class MemberUpdate(BaseModel):
    role: WorkspaceRole
