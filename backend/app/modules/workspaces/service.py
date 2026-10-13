"""Workspace service - business logic layer.

``require_member`` is the authorization check every workspace-scoped feature
uses: a user who is not a member gets the same 404 as for a missing workspace.
"""

import re
import uuid

from app.modules.teams.models import WorkflowStateType
from app.modules.workspaces.models import Workspace, WorkspaceMember, WorkspaceRole
from app.modules.workspaces.repository import (
    WorkspaceMemberRepository,
    WorkspaceRepository,
)
from app.modules.workspaces.schemas import WorkspaceCreate
from app.repositories.exceptions import DuplicateError, NotFoundError
from app.services.base_crud_service import BaseService

DEFAULT_TEAM_NAME = "Engineering"

# (name, type, color) in board order; Linear's default workflow.
DEFAULT_STATES: list[tuple[str, WorkflowStateType, str]] = [
    ("Backlog", WorkflowStateType.backlog, "#bec2c8"),
    ("Todo", WorkflowStateType.unstarted, "#e2e2e2"),
    ("In Progress", WorkflowStateType.started, "#f2c94c"),
    ("In Review", WorkflowStateType.started, "#0f783c"),
    ("Done", WorkflowStateType.completed, "#5e6ad2"),
    ("Canceled", WorkflowStateType.canceled, "#95a2b3"),
]

DEFAULT_LABELS: list[tuple[str, str]] = [
    ("Bug", "#eb5757"),
    ("Feature", "#bb87fc"),
    ("Improvement", "#4ea7fc"),
]


def derive_team_key(team_name: str) -> str:
    """``Engineering`` -> ``ENG``: the first three letters, uppercase (2-5 letters)."""
    letters = re.sub(r"[^A-Za-z]", "", team_name).upper()
    return letters[:3] if len(letters) >= 2 else "TEAM"


class WorkspaceService(BaseService[Workspace]):
    def __init__(
        self, repo: WorkspaceRepository, member_repo: WorkspaceMemberRepository
    ) -> None:
        self.repo = repo
        self.member_repo = member_repo

    async def require_member(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkspaceMember:
        """Return the user's membership, or raise the 404 of a missing workspace."""
        membership = await self.member_repo.get_membership(workspace_id, user_id)
        if membership is None:
            raise NotFoundError(detail=f"Workspace {workspace_id} not found")
        return membership

    async def require_admin(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkspaceMember:
        """Like ``require_member``, and the member must be an admin (else 404 too)."""
        membership = await self.require_member(workspace_id, user_id)
        if membership.role != WorkspaceRole.admin:
            raise NotFoundError(detail=f"Workspace {workspace_id} not found")
        return membership

    async def are_members(
        self, workspace_id: uuid.UUID, user_ids: set[uuid.UUID]
    ) -> bool:
        """True when every user in ``user_ids`` is a member of the workspace."""
        return await self.member_repo.count_members(workspace_id, user_ids) == len(
            user_ids
        )

    async def create_workspace(
        self, data: WorkspaceCreate, *, user_id: uuid.UUID
    ) -> Workspace:
        """Create a workspace; the creator becomes admin and joins the first team."""
        taken = await self.repo.get_by_field("url_key", data.url_key, raise_error=False)
        if taken is not None:
            raise DuplicateError(detail=f"URL key '{data.url_key}' is already taken")
        team_name = data.team_name or DEFAULT_TEAM_NAME
        workspace = await self.repo.create_with_defaults(
            workspace={"name": data.name, "url_key": data.url_key},
            creator_id=user_id,
            team={
                "name": team_name,
                "key": data.team_key or derive_team_key(team_name),
            },
            states=[
                {"name": name, "type": state_type, "color": color, "position": i}
                for i, (name, state_type, color) in enumerate(DEFAULT_STATES)
            ],
            labels=[{"name": name, "color": color} for name, color in DEFAULT_LABELS],
        )
        self._log_entity(workspace.id)
        return workspace

    async def list_for_user(self, user_id: uuid.UUID) -> list[Workspace]:
        return await self.repo.list_for_user(user_id)

    async def get_by_url_key(self, url_key: str, *, user_id: uuid.UUID) -> Workspace:
        workspace = await self.repo.get_by_field("url_key", url_key, raise_error=False)
        detail = f"Workspace '{url_key}' not found"
        if workspace is None:
            raise NotFoundError(detail=detail)
        if await self.member_repo.get_membership(workspace.id, user_id) is None:
            raise NotFoundError(detail=detail)
        self._log_entity(workspace.id)
        return workspace

    async def list_members(
        self, workspace_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> list[WorkspaceMember]:
        await self.require_member(workspace_id, user_id)
        return await self.member_repo.list_with_users(workspace_id)
