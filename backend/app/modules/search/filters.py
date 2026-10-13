"""Search query helpers (the search endpoint has no list filter)."""

import re

# "ENG-12" (team key + number), case-insensitive.
IDENTIFIER_PATTERN = re.compile(r"^([A-Za-z]{2,5})-(\d{1,9})$")


def like_pattern(text: str) -> str:
    """``%text%`` with ``%``, ``_`` and ``\\`` escaped (Postgres' default escape)."""
    escaped = re.sub(r"([\\%_])", r"\\\1", text)
    return f"%{escaped}%"
