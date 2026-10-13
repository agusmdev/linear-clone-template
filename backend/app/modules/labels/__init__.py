"""Labels module: workspace-wide issue labels.

Only models and schemas are re-exported (see app/modules/workspaces/__init__.py).
"""

from .models import Label
from .schemas import LabelCreate, LabelResponse, LabelSummary, LabelUpdate

__all__ = ["Label", "LabelCreate", "LabelResponse", "LabelSummary", "LabelUpdate"]
