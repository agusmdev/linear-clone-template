"""Workspaces module: workspaces, membership and the member check.

Only models and schemas are re-exported: the feature modules depend on each
other's services, so importing routers/services here would make import cycles.
Import those from their submodules (``app.modules.workspaces.service``).
"""

from .exceptions import InvalidReferenceError
from .models import Workspace, WorkspaceMember, WorkspaceRole
from .schemas import WorkspaceCreate, WorkspaceMemberResponse, WorkspaceResponse

__all__ = [
    "InvalidReferenceError",
    "Workspace",
    "WorkspaceCreate",
    "WorkspaceMember",
    "WorkspaceMemberResponse",
    "WorkspaceResponse",
    "WorkspaceRole",
]
