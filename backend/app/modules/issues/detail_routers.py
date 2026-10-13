"""Issue detail router: comments, relations, activity, subscribers, sub-issues."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Depends, Path, status

from app.core.logging import log_action, log_entity
from app.modules.issues.detail_dependencies import (
    get_comment_service,
    get_issue_activity_service,
    get_issue_relation_service,
    get_issue_subscriber_service,
    get_sub_issue_service,
)
from app.modules.issues.detail_schemas import (
    CommentCreate,
    CommentResponse,
    CommentUpdate,
    IssueActivityResponse,
    IssueRelationCreate,
    IssueRelationResponse,
    IssueSubscriberCreate,
    SubIssuesResponse,
)
from app.modules.issues.detail_service import (
    CommentService,
    IssueActivityService,
    IssueRelationService,
    IssueSubscriberService,
    SubIssueService,
)
from app.user.auth import require_current_user_id
from app.user.schemas import UserSummary

issue_details_router = APIRouter(
    tags=["issues"],
    dependencies=[Depends(require_current_user_id)],
)

# A user id, or "me" for the current user.
UserIdOrMe = Annotated[
    str,
    Path(
        pattern=r"^(me|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
        r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$"
    ),
]


# --- Comments (ISS-9) ---------------------------------------------------------


@issue_details_router.get(
    "/issues/{issue_id}/comments",
    response_description="List the comments of an issue (oldest first)",
    status_code=status.HTTP_200_OK,
)
async def list_comments(
    issue_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    comment_service: CommentService = Depends(get_comment_service),
) -> list[CommentResponse]:
    log_action("list_comments")
    log_entity("issue", issue_id)
    result = await comment_service.list_comments(issue_id, user_id=user_id)
    return [CommentResponse.model_validate(c) for c in result]


@issue_details_router.post(
    "/issues/{issue_id}/comments",
    response_description="Comment on an issue",
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    issue_id: uuid.UUID,
    comment: CommentCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    comment_service: CommentService = Depends(get_comment_service),
) -> CommentResponse:
    log_action("create_comment")
    log_entity("issue", issue_id)
    result = await comment_service.create_comment(issue_id, comment, user_id=user_id)
    return CommentResponse.model_validate(result)


@issue_details_router.patch(
    "/comments/{comment_id}",
    response_description="Edit your comment",
    status_code=status.HTTP_200_OK,
)
async def update_comment(
    comment_id: uuid.UUID,
    comment: CommentUpdate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    comment_service: CommentService = Depends(get_comment_service),
) -> CommentResponse:
    log_action("update_comment")
    result = await comment_service.update_comment(comment_id, comment, user_id=user_id)
    return CommentResponse.model_validate(result)


@issue_details_router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Delete your comment",
)
async def delete_comment(
    comment_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    comment_service: CommentService = Depends(get_comment_service),
) -> None:
    log_action("delete_comment")
    await comment_service.delete_comment(comment_id, user_id=user_id)


# --- Relations (ISS-8) --------------------------------------------------------


@issue_details_router.get(
    "/issues/{issue_id}/relations",
    response_description="List the relations of an issue (both directions)",
    status_code=status.HTTP_200_OK,
)
async def list_relations(
    issue_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    relation_service: IssueRelationService = Depends(get_issue_relation_service),
) -> list[IssueRelationResponse]:
    log_action("list_relations")
    log_entity("issue", issue_id)
    return await relation_service.list_relations(issue_id, user_id=user_id)


@issue_details_router.post(
    "/issues/{issue_id}/relations",
    response_description="Relate an issue to another issue",
    status_code=status.HTTP_201_CREATED,
)
async def create_relation(
    issue_id: uuid.UUID,
    relation: IssueRelationCreate = Body(...),
    user_id: uuid.UUID = Depends(require_current_user_id),
    relation_service: IssueRelationService = Depends(get_issue_relation_service),
) -> IssueRelationResponse:
    log_action("create_relation")
    log_entity("issue", issue_id)
    return await relation_service.create_relation(issue_id, relation, user_id=user_id)


@issue_details_router.delete(
    "/issue-relations/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Remove a relation",
)
async def delete_relation(
    relation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    relation_service: IssueRelationService = Depends(get_issue_relation_service),
) -> None:
    log_action("delete_relation")
    await relation_service.delete_relation(relation_id, user_id=user_id)


# --- Activity (ISS-10) --------------------------------------------------------


@issue_details_router.get(
    "/issues/{issue_id}/activity",
    response_description="The history of an issue (oldest first)",
    status_code=status.HTTP_200_OK,
)
async def list_activity(
    issue_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    activity_service: IssueActivityService = Depends(get_issue_activity_service),
) -> list[IssueActivityResponse]:
    log_action("list_activity")
    log_entity("issue", issue_id)
    result = await activity_service.list_activity(issue_id, user_id=user_id)
    return [IssueActivityResponse.model_validate(a) for a in result]


# --- Subscribers (ISS-11) -----------------------------------------------------


@issue_details_router.get(
    "/issues/{issue_id}/subscribers",
    response_description="List the subscribers of an issue",
    status_code=status.HTTP_200_OK,
)
async def list_subscribers(
    issue_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    subscriber_service: IssueSubscriberService = Depends(get_issue_subscriber_service),
) -> list[UserSummary]:
    log_action("list_subscribers")
    log_entity("issue", issue_id)
    result = await subscriber_service.list_subscribers(issue_id, user_id=user_id)
    return [UserSummary.model_validate(u) for u in result]


@issue_details_router.post(
    "/issues/{issue_id}/subscribers",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Subscribe a user (default: me) to an issue",
)
async def subscribe(
    issue_id: uuid.UUID,
    subscriber: IssueSubscriberCreate = Body(default_factory=IssueSubscriberCreate),
    user_id: uuid.UUID = Depends(require_current_user_id),
    subscriber_service: IssueSubscriberService = Depends(get_issue_subscriber_service),
) -> None:
    log_action("subscribe")
    log_entity("issue", issue_id)
    await subscriber_service.subscribe(issue_id, subscriber.user_id, user_id=user_id)


@issue_details_router.delete(
    "/issues/{issue_id}/subscribers/{subscriber_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_description="Unsubscribe a user (or me) from an issue",
)
async def unsubscribe(
    issue_id: uuid.UUID,
    subscriber_id: UserIdOrMe,
    user_id: uuid.UUID = Depends(require_current_user_id),
    subscriber_service: IssueSubscriberService = Depends(get_issue_subscriber_service),
) -> None:
    log_action("unsubscribe")
    log_entity("issue", issue_id)
    target = user_id if subscriber_id == "me" else uuid.UUID(subscriber_id)
    await subscriber_service.unsubscribe(issue_id, target, user_id=user_id)


# --- Sub-issues (ISS-7) -------------------------------------------------------


@issue_details_router.get(
    "/issues/{issue_id}/sub-issues",
    response_description="The sub-issues of an issue and the progress counts",
    status_code=status.HTTP_200_OK,
)
async def list_sub_issues(
    issue_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_current_user_id),
    sub_issue_service: SubIssueService = Depends(get_sub_issue_service),
) -> SubIssuesResponse:
    log_action("list_sub_issues")
    log_entity("issue", issue_id)
    return await sub_issue_service.list_sub_issues(issue_id, user_id=user_id)
