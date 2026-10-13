"""Document model: a rich-text page of a workspace (see docs/API.md, section 3)."""

import uuid

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.database.mixins import TimestampMixin
from app.modules.projects.models import Project
from app.user.models import User


class Document(TimestampMixin, Base):
    """A rich-text document (HTML from TipTap), optionally in a project or team."""

    __tablename__ = "document"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("project.id", ondelete="SET NULL"), index=True, default=None
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team.id", ondelete="SET NULL"), index=True, default=None
    )
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text, default="", server_default="")
    icon: Mapped[str | None] = mapped_column(String(64), default=None)
    creator_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )
    last_edited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), index=True, default=None
    )
    sort_order: Mapped[float] = mapped_column(Float, default=0)

    # Read-only relationships for the response; always loaded explicitly
    # (DocumentRepository.LOAD_OPTIONS), never lazily.
    creator: Mapped[User | None] = relationship(
        foreign_keys=[creator_id], lazy="raise_on_sql", viewonly=True
    )
    last_edited_by: Mapped[User | None] = relationship(
        foreign_keys=[last_edited_by_id], lazy="raise_on_sql", viewonly=True
    )
    project: Mapped[Project | None] = relationship(
        foreign_keys=[project_id], lazy="raise_on_sql", viewonly=True
    )
