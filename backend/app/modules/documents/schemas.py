"""Document schemas - request and response models."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel
from app.modules.issues.schemas import single_line_title
from app.user.schemas import UserSummary

TITLE_MAX = 255
CONTENT_MAX = 1_000_000
ICON_MAX = 64

# One line, ends trimmed; a blank title is a 422.
DocumentTitle = Annotated[
    str,
    BeforeValidator(single_line_title),
    StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX),
]


class DocumentCreate(BaseModel):
    workspace_id: uuid.UUID
    title: DocumentTitle
    # HTML from the TipTap editor.
    content: str = Field("", max_length=CONTENT_MAX)
    # An emoji.
    icon: str | None = Field(None, max_length=ICON_MAX)
    project_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None


class DocumentUpdateFields(BaseModel):
    title: DocumentTitle
    content: str = Field(..., max_length=CONTENT_MAX)
    icon: str | None = Field(None, max_length=ICON_MAX)
    project_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    sort_order: float = Field(..., allow_inf_nan=False)


@partial_model
class DocumentUpdate(DocumentUpdateFields):
    """PATCH: every field can be left out; only the sent fields change."""

    pass


class ProjectRef(OrmBaseModel):
    """The project a document is in."""

    id: uuid.UUID
    name: str


class DocumentSummary(OrmBaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID | None
    team_id: uuid.UUID | None
    title: str
    icon: str | None
    creator_id: uuid.UUID | None
    creator: UserSummary | None
    last_edited_by_id: uuid.UUID | None
    last_edited_by: UserSummary | None
    project: ProjectRef | None
    sort_order: float
    created_at: datetime
    updated_at: datetime


class DocumentResponse(DocumentSummary):
    content: str
