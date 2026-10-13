"""Favorite model (sidebar favorites). The API is not implemented yet (see docs/API.md)."""

import enum
import uuid

from sqlalchemy import Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.enums import str_enum
from app.database.mixins import TimestampMixin


class FavoriteEntityType(enum.StrEnum):
    issue = "issue"
    project = "project"
    document = "document"
    team = "team"


class Favorite(TimestampMixin, Base):
    """A user's favorite. ``entity_id`` points to a row of ``entity_type`` (no FK)."""

    __tablename__ = "favorite"
    __table_args__ = (UniqueConstraint("user_id", "entity_type", "entity_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[FavoriteEntityType] = mapped_column(
        str_enum(FavoriteEntityType, "favorite_entity_type")
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    sort_order: Mapped[float] = mapped_column(Float, default=0)
