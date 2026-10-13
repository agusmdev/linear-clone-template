"""Team, team membership and workflow state models."""

import enum
import uuid

from sqlalchemy import (
    CheckConstraint,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.enums import str_enum
from app.database.mixins import TimestampMixin


class Team(TimestampMixin, Base):
    """A team inside a workspace. Issues are numbered per team: ``<key>-<number>``."""

    __tablename__ = "team"
    __table_args__ = (
        UniqueConstraint("workspace_id", "key"),
        CheckConstraint("key ~ '^[A-Z]{2,5}$'", name="key_format"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    key: Mapped[str] = mapped_column(String(5))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    color: Mapped[str | None] = mapped_column(String(32), default=None)
    icon: Mapped[str | None] = mapped_column(String(64), default=None)
    # The number of the last issue created in this team (incremented atomically).
    issue_counter: Mapped[int] = mapped_column(default=0, server_default="0")


class TeamMember(TimestampMixin, Base):
    """A user's membership in a team."""

    __tablename__ = "team_member"
    __table_args__ = (UniqueConstraint("team_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )


class WorkflowStateType(enum.StrEnum):
    backlog = "backlog"
    unstarted = "unstarted"
    started = "started"
    completed = "completed"
    canceled = "canceled"


class WorkflowState(TimestampMixin, Base):
    """An issue status of a team (Backlog, Todo, In Progress, ...)."""

    __tablename__ = "workflow_state"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[WorkflowStateType] = mapped_column(
        str_enum(WorkflowStateType, "workflow_state_type")
    )
    color: Mapped[str] = mapped_column(String(32))
    position: Mapped[float] = mapped_column(Float, default=0)
