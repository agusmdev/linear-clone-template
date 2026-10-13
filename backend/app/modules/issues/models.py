"""Issue models: issues, labels on issues, relations, subscribers, comments, activity."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.enums import str_enum
from app.database.mixins import TimestampMixin
from app.modules.labels.models import Label
from app.modules.teams.models import Team, WorkflowState
from app.user.models import User


class IssuePriority(enum.IntEnum):
    none = 0
    urgent = 1
    high = 2
    medium = 3
    low = 4


class Issue(TimestampMixin, Base):
    __tablename__ = "issue"
    __table_args__ = (
        UniqueConstraint("team_id", "number"),
        CheckConstraint("priority BETWEEN 0 AND 4", name="priority_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column()
    title: Mapped[str] = mapped_column(String(500))
    # HTML from the TipTap editor.
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # A state with issues cannot be deleted (move the issues first).
    state_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_state.id", ondelete="RESTRICT"), index=True
    )
    priority: Mapped[int] = mapped_column(default=0, server_default="0", index=True)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )
    creator_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("project.id", ondelete="SET NULL"), index=True, default=None
    )
    cycle_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cycle.id", ondelete="SET NULL"), index=True, default=None
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("issue.id", ondelete="SET NULL"), index=True, default=None
    )
    estimate: Mapped[int | None] = mapped_column(default=None)
    due_date: Mapped[date | None] = mapped_column(Date, default=None, index=True)
    sort_order: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    canceled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None, index=True
    )

    # Read-only relationships for the response; always loaded explicitly
    # (IssueRepository.LOAD_OPTIONS), never lazily.
    team: Mapped[Team] = relationship(lazy="raise_on_sql", viewonly=True)
    state: Mapped[WorkflowState] = relationship(lazy="raise_on_sql", viewonly=True)
    assignee: Mapped[User | None] = relationship(
        foreign_keys=[assignee_id], lazy="raise_on_sql", viewonly=True
    )
    creator: Mapped[User | None] = relationship(
        foreign_keys=[creator_id], lazy="raise_on_sql", viewonly=True
    )
    labels: Mapped[list[Label]] = relationship(
        secondary="issue_label",
        lazy="raise_on_sql",
        viewonly=True,
        order_by=Label.name,
    )

    @property
    def identifier(self) -> str:
        """The human id, e.g. ``ENG-12``."""
        return f"{self.team.key}-{self.number}"


class IssueLabel(TimestampMixin, Base):
    """Many-to-many: labels on an issue."""

    __tablename__ = "issue_label"

    issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issue.id", ondelete="CASCADE"), primary_key=True
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("label.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class IssueRelationType(enum.StrEnum):
    blocks = "blocks"
    related = "related"
    duplicate = "duplicate"


class IssueRelation(TimestampMixin, Base):
    """``issue_id`` <type> ``related_issue_id`` (e.g. ENG-1 blocks ENG-2)."""

    __tablename__ = "issue_relation"
    __table_args__ = (
        UniqueConstraint("issue_id", "related_issue_id", "type"),
        CheckConstraint("issue_id <> related_issue_id", name="not_self"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issue.id", ondelete="CASCADE"), index=True
    )
    related_issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issue.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[IssueRelationType] = mapped_column(
        str_enum(IssueRelationType, "issue_relation_type")
    )

    # Read-only, always loaded explicitly (IssueRelationRepository).
    issue: Mapped[Issue] = relationship(
        foreign_keys=[issue_id], lazy="raise_on_sql", viewonly=True
    )
    related_issue: Mapped[Issue] = relationship(
        foreign_keys=[related_issue_id], lazy="raise_on_sql", viewonly=True
    )


class IssueSubscriber(TimestampMixin, Base):
    __tablename__ = "issue_subscriber"
    __table_args__ = (UniqueConstraint("issue_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issue.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )


class Comment(TimestampMixin, Base):
    __tablename__ = "comment"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issue.id", ondelete="CASCADE"), index=True
    )
    # The author; null after the author's account is deleted.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True
    )
    # HTML from the TipTap editor.
    body: Mapped[str] = mapped_column(Text)
    edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    # Read-only, always loaded explicitly (CommentRepository).
    user: Mapped[User | None] = relationship(lazy="raise_on_sql", viewonly=True)


class IssueActivityAction(enum.StrEnum):
    created = "created"
    updated = "updated"
    commented = "commented"
    archived = "archived"
    unarchived = "unarchived"


class IssueActivity(TimestampMixin, Base):
    """One entry of the issue history (one row per changed field)."""

    __tablename__ = "issue_activity"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issue.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )
    action: Mapped[IssueActivityAction] = mapped_column(
        str_enum(IssueActivityAction, "issue_activity_action")
    )
    field: Mapped[str | None] = mapped_column(String(64), default=None)
    from_value: Mapped[str | None] = mapped_column(Text, default=None)
    to_value: Mapped[str | None] = mapped_column(Text, default=None)

    # Read-only, always loaded explicitly (IssueActivityRepository).
    actor: Mapped[User | None] = relationship(lazy="raise_on_sql", viewonly=True)
