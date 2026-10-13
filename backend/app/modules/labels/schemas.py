"""Label schemas - request and response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.optional_model import partial_model
from app.database.mixins import OrmBaseModel

# A CSS hex color: "#eb5757".
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


class LabelSummary(OrmBaseModel):
    """A label embedded in other responses."""

    id: uuid.UUID
    name: str
    color: str


class LabelResponse(LabelSummary):
    workspace_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class LabelFields(BaseModel):
    # Unique per workspace.
    name: str = Field(..., min_length=1, max_length=255)
    color: str = Field(..., pattern=COLOR_PATTERN)


class LabelCreate(LabelFields):
    pass


@partial_model
class LabelUpdate(LabelFields):
    pass
