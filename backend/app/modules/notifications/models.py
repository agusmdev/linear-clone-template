"""Notification model (inbox, UX-3). API: ``app/modules/notifications/routers.py``."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.enums import str_enum
from app.database.mixins import TimestampMixin
from app.modules.issues.models import Comment, Issue
from app.modules.teams.models import WorkflowState
from app.user.models import User


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
    # ``status_changed``: the state the issue moved to. The issue's current
    # state can change again later; this one stays what the actor picked.
    state_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workflow_state.id", ondelete="SET NULL"), index=True, default=None
    )
    # ``commented``: the new comment (the notification goes with it).
    comment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("comment.id", ondelete="CASCADE"), index=True, default=None
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    # Read-only relationships for the response; always loaded explicitly
    # (notifications.repository.LOAD_OPTIONS), never lazily.
    issue: Mapped[Issue | None] = relationship(lazy="raise_on_sql", viewonly=True)
    state: Mapped[WorkflowState | None] = relationship(
        lazy="raise_on_sql", viewonly=True
    )
    comment: Mapped[Comment | None] = relationship(lazy="raise_on_sql", viewonly=True)
    actor: Mapped[User | None] = relationship(
        foreign_keys=[actor_id], lazy="raise_on_sql", viewonly=True
    )
