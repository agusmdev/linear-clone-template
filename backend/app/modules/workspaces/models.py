"""Workspace and workspace membership models."""

import enum
import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.enums import str_enum
from app.database.mixins import TimestampMixin
from app.user.models import User


class WorkspaceRole(enum.StrEnum):
    admin = "admin"
    member = "member"


class Workspace(TimestampMixin, Base):
    """A Linear workspace: the top-level tenant. Every other entity belongs to one."""

    __tablename__ = "workspace"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    # The slug in the app URL: /<url_key>/...
    url_key: Mapped[str] = mapped_column(String(48), unique=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )


class WorkspaceMember(TimestampMixin, Base):
    """A user's membership in a workspace, with a role."""

    __tablename__ = "workspace_member"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[WorkspaceRole] = mapped_column(
        str_enum(WorkspaceRole, "workspace_role"), default=WorkspaceRole.member
    )

    user: Mapped[User] = relationship(lazy="raise_on_sql", viewonly=True)
