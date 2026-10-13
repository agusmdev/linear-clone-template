"""Favorites module: a user's sidebar favorites (issues, projects, documents, teams).

Only models and schemas are re-exported (see app/modules/workspaces/__init__.py).
"""

from .models import Favorite, FavoriteEntityType
from .schemas import FavoriteCreate, FavoriteResponse, FavoriteUpdate

__all__ = [
    "Favorite",
    "FavoriteCreate",
    "FavoriteEntityType",
    "FavoriteResponse",
    "FavoriteUpdate",
]
