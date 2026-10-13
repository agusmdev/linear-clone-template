"""Workspaces module: workspaces, membership and the member check.

Only models and schemas are re-exported: the feature modules depend on each
other's services, so importing routers/services here would make import cycles.
Import those from their submodules (``app.modules.workspaces.service``).
"""

from .exceptions import (
    InvalidReferenceError,
    LastAdminError,
    LastStateError,
    LastTeamError,
    UserNotFoundError,
)
from .models import Workspace, WorkspaceMember, WorkspaceRole
from .schemas import (
    MemberInvite,
    MemberUpdate,
    WorkspaceCreate,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)

__all__ = [
    "InvalidReferenceError",
    "LastAdminError",
    "LastStateError",
    "LastTeamError",
    "MemberInvite",
    "MemberUpdate",
    "UserNotFoundError",
    "Workspace",
    "WorkspaceCreate",
    "WorkspaceMember",
    "WorkspaceMemberResponse",
    "WorkspaceResponse",
    "WorkspaceRole",
    "WorkspaceUpdate",
]
