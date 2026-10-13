"""Project domain errors."""

from app.exceptions import HTTPExceptionMixin


class InvalidProjectDatesError(HTTPExceptionMixin):
    """``target_date`` is before ``start_date``."""

    detail = "The target date of a project must not be before its start date"
    error_code = "invalid_project_dates"
    status_code = 400
