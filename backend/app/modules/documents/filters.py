"""Document filters for GET /documents."""

import uuid
from typing import Any

from app.core.filters import ModelFilter
from app.core.text_search import html_visible_text, words_match
from app.modules.documents.models import Document


class DocumentFilter(ModelFilter):  # ?order_by= accepts Document columns only
    """Query parameters of GET /documents (``workspace_id`` is a separate parameter).

    ?project_id=  ?team_id=
    ?search=      every word in the title or visible text of the content, in any
                  order (ILIKE; % and _ are literal)
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
        if self.search and self.search.split():
            # Every word, in any order, like the search page: "guide onboarding"
            # finds "Onboarding guide".
            query = query.where(
                words_match(
                    self.search, Document.title, html_visible_text(Document.content)
                )
            )
        return query

    def sort(self, query: Any) -> Any:
        # A unique last key keeps pages stable when the sort values tie.
        return super().sort(query).order_by(Document.id)
