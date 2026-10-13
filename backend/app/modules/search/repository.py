"""Search repository - read-only queries over issues, documents and projects."""

import uuid
from typing import Any

from sqlalchemy import and_, case, or_, select
from sqlalchemy.orm import selectinload

from app.core.text_search import html_visible_text, like_pattern
from app.modules.documents.models import Document
from app.modules.issues.models import Issue
from app.modules.projects.models import Project
from app.modules.search.filters import IDENTIFIER_PATTERN
from app.modules.teams.models import Team
from app.repositories.sql_repository import SQLAlchemyRepository


def _words_match(text: str, *columns: Any) -> Any:
    """Every word of ``text`` is in one of ``columns`` (any order), so
    "redirect login" finds "Fix login redirect"."""
    return and_(
        *(
            or_(*(column.ilike(like_pattern(word)) for column in columns))
            for word in text.split()
        )
    )


class SearchRepository(SQLAlchemyRepository[Issue]):
    model = Issue

    async def search_issues(
        self, workspace_id: uuid.UUID, text: str, limit: int
    ) -> list[Issue]:
        """Issues whose title and description (visible text) hold every word,
        or whose identifier matches (not archived).

        An exact identifier match (``ENG-12`` or ``12``) comes first, then the
        most recently updated issues.
        """
        conditions: list[Any] = [
            _words_match(text, Issue.title, html_visible_text(Issue.description))
        ]
        exact: Any = None
        if match := IDENTIFIER_PATTERN.match(text):
            exact = (Team.key == match.group(1).upper()) & (
                Issue.number == int(match.group(2))
            )
        elif text.isdigit() and len(text) <= 9:
            exact = Issue.number == int(text)
        query = (
            select(Issue)
            .join(Team, Team.id == Issue.team_id)
            .options(selectinload(Issue.team), selectinload(Issue.state))
            .where(Issue.workspace_id == workspace_id, Issue.archived_at.is_(None))
        )
        if exact is not None:
            conditions.append(exact)
            query = query.order_by(case((exact, 0), else_=1))
        query = (
            query.where(or_(*conditions))
            .order_by(Issue.updated_at.desc(), Issue.id)
            .limit(limit)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def search_documents(
        self, workspace_id: uuid.UUID, text: str, limit: int
    ) -> list[Document]:
        query = (
            select(Document)
            .where(
                Document.workspace_id == workspace_id,
                _words_match(text, Document.title, html_visible_text(Document.content)),
            )
            .order_by(Document.updated_at.desc(), Document.id)
            .limit(limit)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def search_projects(
        self, workspace_id: uuid.UUID, text: str, limit: int
    ) -> list[Project]:
        query = (
            select(Project)
            .where(
                Project.workspace_id == workspace_id,
                _words_match(
                    text, Project.name, html_visible_text(Project.description)
                ),
            )
            .order_by(Project.updated_at.desc(), Project.id)
            .limit(limit)
        )
        return list((await self._session.execute(query)).scalars().all())
