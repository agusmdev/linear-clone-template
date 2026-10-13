"""Workspace domain errors."""

from app.exceptions import HTTPExceptionMixin


class InvalidReferenceError(HTTPExceptionMixin):
    """A request points to a row of another workspace or team (or to no row)."""

    detail = "A referenced entity does not exist in this workspace"
    error_code = "invalid_reference"
    status_code = 400
