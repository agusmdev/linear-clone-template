"""Label schemas - response models."""

import uuid
from datetime import datetime

from app.database.mixins import OrmBaseModel


class LabelSummary(OrmBaseModel):
    """A label embedded in other responses."""

    id: uuid.UUID
    name: str
    color: str


class LabelResponse(LabelSummary):
    workspace_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
