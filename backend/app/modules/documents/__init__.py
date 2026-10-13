"""Documents module: rich-text documents of a workspace (see docs/API.md).

Only models and schemas are re-exported (see app/modules/workspaces/__init__.py).
"""

from .models import Document
from .schemas import DocumentResponse, DocumentSummary

__all__ = ["Document", "DocumentResponse", "DocumentSummary"]
