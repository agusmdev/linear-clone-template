"""Dependency factory functions for the issue detail resources."""

from fastapi import Depends

from app.dependencies import get_repository
from app.modules.issues.dependencies import get_issue_service
from app.modules.issues.detail_repository import (
    CommentRepository,
    IssueActivityRepository,
    IssueRelationRepository,
    IssueSubscriberRepository,
    SubIssueRepository,
)
from app.modules.issues.detail_service import (
    CommentService,
    IssueActivityService,
    IssueRelationService,
    IssueSubscriberService,
    SubIssueService,
)
from app.modules.issues.service import IssueService


def get_comment_service(
    repo: CommentRepository = Depends(get_repository(CommentRepository)),
    issue_service: IssueService = Depends(get_issue_service),
) -> CommentService:
    return CommentService(repo=repo, issue_service=issue_service)


def get_issue_relation_service(
    repo: IssueRelationRepository = Depends(get_repository(IssueRelationRepository)),
    issue_service: IssueService = Depends(get_issue_service),
) -> IssueRelationService:
    return IssueRelationService(repo=repo, issue_service=issue_service)


def get_issue_subscriber_service(
    repo: IssueSubscriberRepository = Depends(
        get_repository(IssueSubscriberRepository)
    ),
    issue_service: IssueService = Depends(get_issue_service),
) -> IssueSubscriberService:
    return IssueSubscriberService(repo=repo, issue_service=issue_service)


def get_issue_activity_service(
    repo: IssueActivityRepository = Depends(get_repository(IssueActivityRepository)),
    issue_service: IssueService = Depends(get_issue_service),
) -> IssueActivityService:
    return IssueActivityService(repo=repo, issue_service=issue_service)


def get_sub_issue_service(
    repo: SubIssueRepository = Depends(get_repository(SubIssueRepository)),
    issue_service: IssueService = Depends(get_issue_service),
) -> SubIssueService:
    return SubIssueService(repo=repo, issue_service=issue_service)
