"""Workspace domain errors (also used by the teams and labels modules)."""

from app.exceptions import HTTPExceptionMixin


class InvalidReferenceError(HTTPExceptionMixin):
    """A request points to a row of another workspace or team (or to no row)."""

    detail = "A referenced entity does not exist in this workspace"
    error_code = "invalid_reference"
    status_code = 400


class UserNotFoundError(HTTPExceptionMixin):
    """An invite names an email that has no account."""

    detail = "No user with this email exists"
    error_code = "user_not_found"
    status_code = 404


class LastAdminError(HTTPExceptionMixin):
    """The change would leave the workspace without an admin."""

    detail = "A workspace needs at least one admin"
    error_code = "last_admin"
    status_code = 400


class LastTeamError(HTTPExceptionMixin):
    """The change would leave the workspace without a team."""

    detail = "A workspace needs at least one team"
    error_code = "last_team"
    status_code = 400


class LastStateError(HTTPExceptionMixin):
    """The change would leave the team without a workflow state."""

    detail = "A team needs at least one workflow state"
    error_code = "last_state"
    status_code = 400
