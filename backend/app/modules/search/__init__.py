"""Search module: workspace-wide search over issues, documents and projects.

Only schemas are re-exported (see app/modules/workspaces/__init__.py).
"""

from .schemas import (
    DocumentSearchResult,
    IssueSearchResult,
    ProjectSearchResult,
    SearchResponse,
    SearchType,
)

__all__ = [
    "DocumentSearchResult",
    "IssueSearchResult",
    "ProjectSearchResult",
    "SearchResponse",
    "SearchType",
]
