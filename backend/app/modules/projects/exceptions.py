"""Project domain errors."""

from app.exceptions import HTTPExceptionMixin

INVALID_DATES_MESSAGE = "The target date must not be before the start date"


class InvalidProjectDatesError(HTTPExceptionMixin):
    """``target_date`` is before ``start_date`` (also the stored one on a PATCH).

    A 422 ``validation_error`` with FastAPI's issue list, like a schema error,
    so clients show it on the ``target_date`` field.
    """

    detail = [
        {
            "loc": ["body", "target_date"],
            "msg": INVALID_DATES_MESSAGE,
            "type": "value_error",
        }
    ]
    error_code = "validation_error"
    status_code = 422
