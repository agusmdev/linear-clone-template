"""Favorite schemas - request and response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.database.mixins import OrmBaseModel
from app.modules.favorites.models import FavoriteEntityType


class FavoriteCreate(BaseModel):
    workspace_id: uuid.UUID
    entity_type: FavoriteEntityType
    entity_id: uuid.UUID


class FavoriteUpdate(BaseModel):
    sort_order: float = Field(..., allow_inf_nan=False)


class FavoriteResponse(OrmBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    entity_type: FavoriteEntityType
    entity_id: uuid.UUID
    sort_order: float
    # Display name: "ENG-12 Title", project name, document title, team name.
    name: str
    # Issue identifier ("ENG-12") or team key ("ENG"); null for projects/documents.
    # With the workspace URL key it gives the link of the entity.
    identifier: str | None
    icon: str | None
    color: str | None
    created_at: datetime
