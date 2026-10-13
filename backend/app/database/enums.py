"""Column type for ``enum.StrEnum`` values (Postgres native enum)."""

import enum

from sqlalchemy import Enum as SAEnum


def str_enum(enum_cls: type[enum.StrEnum], name: str) -> SAEnum:
    """Return a native Postgres enum type that stores the members' values.

    By default SQLAlchemy stores the member names; with ``values_callable`` the
    database holds the same lowercase strings the API sends and receives.
    """
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )
