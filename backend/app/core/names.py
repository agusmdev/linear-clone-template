"""Shared request field type for the names users type in forms."""

from typing import Annotated

from pydantic import StringConstraints

# The name of a workspace, team, workflow state or label: surrounding spaces
# are removed and a blank name is a 422. Without this, "   " is stored as an
# invisible name and " Bug " sits next to "Bug". Same rule as the frontend
# forms (zod ``trim().min(1)``). Use it on request models only, so a response
# still serializes a row stored before the rule.
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]
