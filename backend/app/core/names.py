"""Shared request field type for the names users type in forms."""

import re
from typing import Annotated, Any

from pydantic import BeforeValidator, StringConstraints

# A line break (and the spaces around it) inside a name.
_LINE_BREAK = re.compile(r"\s*[\r\n\v\f\x85  ]+\s*")


def single_line(value: Any) -> Any:
    """Names are one line: line breaks become one space (like issue titles).

    A name of only line breaks becomes '' and fails ``min_length``.
    """
    if not isinstance(value, str):
        return value
    return _LINE_BREAK.sub(" ", value).strip()


# The name of a workspace, team, workflow state or label: one line, surrounding
# spaces are removed and a blank name is a 422. Without this, "   " is stored as
# an invisible name, " Bug " sits next to "Bug" and a pasted "A\nB" breaks the
# one-line rows of the UI. Same rule as the frontend forms (zod
# ``trim().min(1)``; an <input> drops line breaks). Use it on request models
# only, so a response still serializes a row stored before the rule.
Name = Annotated[
    str,
    BeforeValidator(single_line),
    StringConstraints(strip_whitespace=True, min_length=1, max_length=255),
]
