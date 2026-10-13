"""Document filters for GET /documents."""

import uuid
from typing import Any

from sqlalchemy import or_

from app.core.filters import ModelFilter
from app.core.text_search import html_visible_text, like_pattern
from app.modules.documents.models import Document


class DocumentFilter(ModelFilter):  # ?order_by= accepts Document columns only
    """Query parameters of GET /documents (``workspace_id`` is a separate parameter).

    ?project_id=  ?team_id=
    ?search=      title or visible text of the content (ILIKE; % and _ are literal)
    ?order_by=    default -updated_at; e.g. title, sort_order, -created_at
    """

    order_by: list[str] = ["-updated_at"]
    project_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    search: str | None = None

    class Constants(ModelFilter.Constants):
        model = Document

    def filter(self, query: Any) -> Any:
        plain = self.model_copy(update={"search": None})
        query = super(DocumentFilter, plain).filter(query)
        if self.search:
            term = like_pattern(self.search)
            query = query.where(
                or_(
                    Document.title.ilike(term),
                    html_visible_text(Document.content).ilike(term),
                )
            )
        return query

    def sort(self, query: Any) -> Any:
        # A unique last key keeps pages stable when the sort values tie.
        return super().sort(query).order_by(Document.id)
