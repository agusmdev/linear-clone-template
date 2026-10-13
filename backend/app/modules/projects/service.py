"""Project service - business logic layer.

Every method checks that the user is a member of the project's workspace (a
non-member gets the 404 of a missing project). The lead must be a member of
the workspace and the teams must be teams of the workspace, else 400
``invalid_reference``. Responses embed the lead, the teams and the issue
progress (completed / total; canceled and archived issues are not counted).
The target date must not be before the start date (also after a PATCH that
sends only one of them), else 422 ``validation_error``.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime

from app.modules.projects.exceptions import InvalidProjectDatesError
from app.modules.projects.models import Project, ProjectStatus
from app.modules.projects.repository import ProjectRepository
from app.modules.projects.schemas import ProjectCreate, ProjectProgress, ProjectUpdate
from app.modules.teams.models import Team
from app.modules.workspaces.exceptions import InvalidReferenceError
from app.modules.workspaces.service import WorkspaceService
from app.repositories.exceptions import NotFoundError
from app.services.base_crud_service import BaseService
from app.user.models import User


@dataclass
class ProjectDetails:
    """A project with the data ``ProjectResponse`` embeds."""

    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str | None
    status: ProjectStatus
    lead_id: uuid.UUID | None
    lead: User | None
    start_date: date | None
    target_date: date | None
    color: str | None
    icon: str | None
    sort_order: float
    team_ids: list[uuid.UUID]
    teams: list[Team]
    issue_count: int
    completed_issue_count: int
    progress: ProjectProgress
    created_at: datetime
    updated_at: datetime


class ProjectService(BaseService[Project]):
    def __init__(
        self, repo: ProjectRepository, workspace_service: WorkspaceService
    ) -> None:
        self.repo = repo
        self.workspace_service = workspace_service

    # --- response data ---------------------------------------------------------

    async def _details(self, projects: list[Project]) -> list[ProjectDetails]:
        ids = [p.id for p in projects]
        teams = await self.repo.teams_by_project(ids)
        counts = await self.repo.issue_counts(ids)
        leads = await self.repo.users_by_ids({p.lead_id for p in projects if p.lead_id})
        result = []
        for p in projects:
            total, completed = counts[p.id]
            percentage = completed * 100 // total if total else 0
            result.append(
                ProjectDetails(
                    id=p.id,
                    workspace_id=p.workspace_id,
                    name=p.name,
                    description=p.description,
                    status=p.status,
                    lead_id=p.lead_id,
                    lead=leads.get(p.lead_id) if p.lead_id else None,
                    start_date=p.start_date,
                    target_date=p.target_date,
                    color=p.color,
                    icon=p.icon,
                    sort_order=p.sort_order,
                    team_ids=[t.id for t in teams[p.id]],
                    teams=teams[p.id],
                    issue_count=total,
                    completed_issue_count=completed,
                    progress=ProjectProgress(
                        total=total, completed=completed, percentage=percentage
                    ),
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
            )
        return result

    async def _one(self, project: Project) -> ProjectDetails:
        return (await self._details([project]))[0]

    async def _get_member_project(
        self, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> Project:
        project = await self.repo.get_fresh(project_id)
        detail = f"Project {project_id} not found"
        if project is None:
            raise NotFoundError(detail=detail)
        try:
            await self.workspace_service.require_member(project.workspace_id, user_id)
        except NotFoundError as err:
            raise NotFoundError(detail=detail) from err
        self._log_entity(project.id)
        return project

    # --- validation ------------------------------------------------------------

    async def _check_lead(
        self, workspace_id: uuid.UUID, lead_id: uuid.UUID | None
    ) -> None:
        if lead_id is not None and not await self.workspace_service.are_members(
            workspace_id, {lead_id}
        ):
            raise InvalidReferenceError(
                detail=f"User {lead_id} is not a member of this workspace"
            )

    @staticmethod
    def _check_dates(start_date: date | None, target_date: date | None) -> None:
        if start_date and target_date and target_date < start_date:
            raise InvalidProjectDatesError()

    async def _check_teams(
        self, workspace_id: uuid.UUID, team_ids: set[uuid.UUID]
    ) -> None:
        teams = await self.repo.teams_by_ids(team_ids)
        if len(teams) != len(team_ids) or any(
            t.workspace_id != workspace_id for t in teams
        ):
            raise InvalidReferenceError(
                detail="Every team must be a team of this workspace"
            )

    # --- API -------------------------------------------------------------------

    async def list_projects(
        self,
        workspace_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
        status: ProjectStatus | None = None,
        team_id: uuid.UUID | None = None,
    ) -> list[ProjectDetails]:
        await self.workspace_service.require_member(workspace_id, user_id)
        projects = await self.repo.list_for_workspace(
            workspace_id, status=status, team_id=team_id
        )
        return await self._details(projects)

    async def get_project(
        self, project_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> ProjectDetails:
        return await self._one(await self._get_member_project(project_id, user_id))

    async def create_project(
        self, data: ProjectCreate, *, user_id: uuid.UUID
    ) -> ProjectDetails:
        workspace_id = data.workspace_id
        await self.workspace_service.require_member(workspace_id, user_id)
        self._check_dates(data.start_date, data.target_date)
        await self._check_lead(workspace_id, data.lead_id)
        team_ids = set(data.team_ids)
        await self._check_teams(workspace_id, team_ids)
        values = data.model_dump(exclude={"team_ids"})
        values["sort_order"] = await self.repo.next_sort_order(workspace_id)
        project = await self.repo.create_project(values, team_ids=team_ids)
        self._log_entity(project.id)
        return await self._one(project)

    async def update_project(
        self, project_id: uuid.UUID, data: ProjectUpdate, *, user_id: uuid.UUID
    ) -> ProjectDetails:
        project = await self._get_member_project(project_id, user_id)
        changes = data.model_dump(exclude_unset=True)
        # A PATCH may send one date only: compare it with the stored other one.
        self._check_dates(
            changes.get("start_date", project.start_date),
            changes.get("target_date", project.target_date),
        )
        team_ids: set[uuid.UUID] | None = None
        if "team_ids" in changes:
            team_ids = set(changes.pop("team_ids"))
            await self._check_teams(project.workspace_id, team_ids)
        if "lead_id" in changes:
            await self._check_lead(project.workspace_id, changes["lead_id"])
        updated = await self.repo.update_project(project.id, changes, team_ids=team_ids)
        return await self._one(updated)

    async def delete_project(
        self, project_id: uuid.UUID, *, user_id: uuid.UUID
    ) -> None:
        """Delete the project; its issues and documents stay (``project_id = null``)."""
        project = await self._get_member_project(project_id, user_id)
        await self.repo.delete(project.id)
