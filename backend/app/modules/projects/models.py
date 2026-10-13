"""Project models. The API for projects is not implemented yet (see docs/API.md)."""

import enum
import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.enums import str_enum
from app.database.mixins import TimestampMixin


class ProjectStatus(enum.StrEnum):
    planned = "planned"
    started = "started"
    paused = "paused"
    completed = "completed"
    canceled = "canceled"


class Project(TimestampMixin, Base):
    __tablename__ = "project"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[ProjectStatus] = mapped_column(
        str_enum(ProjectStatus, "project_status"), default=ProjectStatus.planned
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )
    start_date: Mapped[date | None] = mapped_column(Date, default=None)
    target_date: Mapped[date | None] = mapped_column(Date, default=None)
    color: Mapped[str | None] = mapped_column(String(32), default=None)
    icon: Mapped[str | None] = mapped_column(String(64), default=None)
    sort_order: Mapped[float] = mapped_column(Float, default=0)


class ProjectTeam(TimestampMixin, Base):
    """Many-to-many: the teams that work on a project."""

    __tablename__ = "project_team"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("project.id", ondelete="CASCADE"), primary_key=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team.id", ondelete="CASCADE"), primary_key=True, index=True
    )
