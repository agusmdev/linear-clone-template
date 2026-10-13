"""Cycle model. The API for cycles is not implemented yet (see docs/API.md)."""

import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.database.mixins import TimestampMixin


class Cycle(TimestampMixin, Base):
    """A time-boxed iteration of a team, numbered per team."""

    __tablename__ = "cycle"
    __table_args__ = (
        UniqueConstraint("team_id", "number"),
        CheckConstraint("ends_at >= starts_at", name="dates_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column()
    name: Mapped[str | None] = mapped_column(String(255), default=None)
    starts_at: Mapped[date] = mapped_column(Date)
    ends_at: Mapped[date] = mapped_column(Date)
