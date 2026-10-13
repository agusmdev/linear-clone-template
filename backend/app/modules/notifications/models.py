"""Notification model (inbox). The API is not implemented yet (see docs/API.md)."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.enums import str_enum
from app.database.mixins import TimestampMixin


class NotificationType(enum.StrEnum):
    assigned = "assigned"
    commented = "commented"
    status_changed = "status_changed"
    mentioned = "mentioned"


class Notification(TimestampMixin, Base):
    __tablename__ = "notification"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # The recipient.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True
    )
    issue_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("issue.id", ondelete="CASCADE"), index=True, default=None
    )
    # Who caused it.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )
    type: Mapped[NotificationType] = mapped_column(
        str_enum(NotificationType, "notification_type")
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
