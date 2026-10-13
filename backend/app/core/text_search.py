"""Text search helpers shared by the list filters and the search endpoint."""

import re
from typing import Any

from sqlalchemy import and_, func, or_

# Block tags of the TipTap HTML. They separate words, so they become a space.
# Every other tag (strong, em, a, span, ...) is removed with no space, so
# "<strong>wo</strong>rd" still reads "word".
_BLOCK_TAG = r"</?(p|h[1-6]|li|ul|ol|blockquote|pre|div|br|hr|tr|td|th)(\s[^>]*)?/?>"
_ANY_TAG = r"<[^>]*>"
# The entities that the browser's HTML serializer writes in text. "&amp;" is
# decoded last, so the stored "&amp;lt;" gives the literal text "&lt;".
_ENTITIES = (
    ("&nbsp;", " "),
    ("&lt;", "<"),
    ("&gt;", ">"),
    ("&quot;", '"'),
    ("&#39;", "'"),
    ("&#x27;", "'"),
    ("&amp;", "&"),
)


def like_pattern(text: str) -> str:
    """``%text%`` with ``%``, ``_`` and ``\\`` escaped (Postgres' default escape)."""
    escaped = re.sub(r"([\\%_])", r"\\\1", text)
    return f"%{escaped}%"


def words_match(text: str, *columns: Any) -> Any:
    """Every word of ``text`` is in one of ``columns`` (any order), so
    "redirect login" finds "Fix login redirect"."""
    return and_(
        *(
            or_(*(column.ilike(like_pattern(word)) for column in columns))
            for word in text.split()
        )
    )


def html_visible_text(column: Any) -> Any:
    """SQL expression: the visible text of a stored HTML column.

    Tags are removed, entities are decoded and runs of white space become one
    space, so a search does not match
    markup (``strong``, ``href``) and ``a & b`` matches the stored ``a &amp; b``.
    """
    text = func.regexp_replace(column, _BLOCK_TAG, " ", "gi")
    text = func.regexp_replace(text, _ANY_TAG, "", "g")
    for entity, char in _ENTITIES:
        text = func.replace(text, entity, char)
    # "</p><p>" gives two spaces: collapse runs, so "end start" matches.
    return func.regexp_replace(text, r"\s+", " ", "g")
