"""Cycle domain errors."""

from app.exceptions import HTTPExceptionMixin


class InvalidCycleDatesError(HTTPExceptionMixin):
    """``ends_at`` is not after ``starts_at``."""

    detail = "The end date of a cycle must be after its start date"
    error_code = "invalid_cycle_dates"
    status_code = 400


class CycleOverlapError(HTTPExceptionMixin):
    """The dates overlap another cycle of the same team."""

    detail = "The dates overlap another cycle of this team"
    error_code = "cycle_overlap"
    status_code = 400


class NoNextCycleError(HTTPExceptionMixin):
    """Completing a cycle needs a later cycle to move the unfinished issues to."""

    detail = "There is no later cycle to move the unfinished issues to"
    error_code = "no_next_cycle"
    status_code = 400
