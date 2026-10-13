"""Search schemas - response models."""

import enum
import uuid

from pydantic import BaseModel

from app.database.mixins import OrmBaseModel
from app.modules.projects.models import ProjectStatus
from app.modules.teams.schemas import TeamSummary, WorkflowStateSummary

SEARCH_LIMIT_MAX = 50


class SearchType(enum.StrEnum):
    issue = "issue"
    document = "document"
    project = "project"


class IssueSearchResult(OrmBaseModel):
    """``IssueRef`` plus the team (the client builds the link from the identifier)."""

    id: uuid.UUID
    identifier: str
    title: str
    state: WorkflowStateSummary
    team: TeamSummary


class DocumentSearchResult(OrmBaseModel):
    id: uuid.UUID
    title: str
    icon: str | None
    project_id: uuid.UUID | None


class ProjectSearchResult(OrmBaseModel):
    id: uuid.UUID
    name: str
    icon: str | None
    color: str | None
    status: ProjectStatus


class SearchResponse(BaseModel):
    issues: list[IssueSearchResult]
    documents: list[DocumentSearchResult]
    projects: list[ProjectSearchResult]
