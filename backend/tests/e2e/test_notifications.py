"""Notifications (inbox, UX-3): creation by issue changes, list, count, read/archive.

``assigned`` goes to the new assignee (never to someone who assigns
themself); ``status_changed`` goes to every subscriber except the actor.
Every read and write is scoped to the recipient: another user's notification
is a 404, like a missing one.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_issue,
    create_workspace,
    join_workspace,
    list_notifications,
    team_states,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database

NOTIFICATION_FIELDS = {
    "id",
    "user_id",
    "workspace_id",
    "issue_id",
    "actor_id",
    "type",
    "read_at",
    "archived_at",
    "created_at",
    "issue",
    "state",
    "actor",
}


@pytest.fixture
def owner(register_user: Callable[..., RegisteredUser]) -> RegisteredUser:
    return register_user(display_name="Owner")


@pytest.fixture
def member(register_user: Callable[..., RegisteredUser]) -> RegisteredUser:
    return register_user(display_name="Member")


@pytest.fixture
def ws(owner: RegisteredUser, member: RegisteredUser, db: Database) -> dict[str, Any]:
    """A workspace of ``owner`` that ``member`` joined, with its team and states."""
    workspace = create_workspace(owner.client)
    join_workspace(db, workspace["id"], member.id)
    team = workspace_team(owner.client, workspace["id"])
    return {
        "workspace": workspace,
        "team": team,
        "states": team_states(owner.client, team["id"]),
    }


def _count(user: RegisteredUser, workspace_id: str) -> int:
    response = user.client.get(
        "/notifications/unread-count", params={"workspace_id": workspace_id}
    )
    assert response.status_code == 200, response.text
    return response.json()["count"]


def test_assigning_someone_notifies_them(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any]
) -> None:
    ws_id = ws["workspace"]["id"]
    issue = create_issue(owner.client, ws["team"]["id"], "Fix login")
    assert list_notifications(member.client, ws_id) == []

    response = owner.client.patch(
        f"/issues/{issue['id']}", json={"assignee_id": member.id}
    )
    assert response.status_code == 200, response.text

    [notification] = list_notifications(member.client, ws_id)
    assert set(notification) == NOTIFICATION_FIELDS
    assert notification["type"] == "assigned"
    assert notification["user_id"] == member.id
    assert notification["workspace_id"] == ws_id
    assert notification["issue_id"] == issue["id"]
    assert notification["actor_id"] == owner.id
    assert notification["read_at"] is None
    assert notification["archived_at"] is None
    assert notification["issue"] == {
        "id": issue["id"],
        "identifier": issue["identifier"],
        "title": "Fix login",
        "state": issue["state"],
    }
    # Only ``status_changed`` carries the state it moved to.
    assert notification["state"] is None
    assert notification["actor"] == {
        "id": owner.id,
        "name": "Owner",
        "email": owner.email,
    }
    # The actor gets nothing.
    assert list_notifications(owner.client, ws_id) == []
    assert _count(member, ws_id) == 1


def test_creating_an_issue_with_an_assignee_notifies_them(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any]
) -> None:
    ws_id = ws["workspace"]["id"]
    create_issue(owner.client, ws["team"]["id"], assignee_id=member.id)
    [notification] = list_notifications(member.client, ws_id)
    assert notification["type"] == "assigned"


def test_assigning_yourself_notifies_nobody(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any]
) -> None:
    ws_id = ws["workspace"]["id"]
    issue = create_issue(member.client, ws["team"]["id"], assignee_id=member.id)
    response = owner.client.patch(f"/issues/{issue['id']}", json={"assignee_id": None})
    assert response.status_code == 200, response.text
    response = owner.client.patch(
        f"/issues/{issue['id']}", json={"assignee_id": owner.id}
    )
    assert response.status_code == 200, response.text
    assert list_notifications(member.client, ws_id) == []
    assert list_notifications(owner.client, ws_id) == []


def test_status_change_notifies_subscribers_except_the_actor(
    owner: RegisteredUser,
    member: RegisteredUser,
    register_user: Callable[..., RegisteredUser],
    ws: dict[str, Any],
    db: Database,
) -> None:
    ws_id = ws["workspace"]["id"]
    outsider = register_user(display_name="Not subscribed")
    join_workspace(db, ws_id, outsider.id)
    # Subscribers: the creator (owner) and the assignee (member).
    issue = create_issue(owner.client, ws["team"]["id"], assignee_id=member.id)
    done = ws["states"]["Done"]

    response = member.client.patch(
        f"/issues/{issue['id']}", json={"state_id": done["id"]}
    )
    assert response.status_code == 200, response.text

    [notification] = list_notifications(owner.client, ws_id)
    assert notification["type"] == "status_changed"
    assert notification["actor_id"] == member.id
    assert notification["issue"]["state"]["name"] == "Done"
    # The member is the actor: only the earlier "assigned" one.
    assert [n["type"] for n in list_notifications(member.client, ws_id)] == ["assigned"]
    assert list_notifications(outsider.client, ws_id) == []

    # The same state again is no change: no new notification.
    member.client.patch(f"/issues/{issue['id']}", json={"state_id": done["id"]})
    assert len(list_notifications(owner.client, ws_id)) == 1


def test_status_change_keeps_the_state_it_moved_to(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any]
) -> None:
    """Each ``status_changed`` names its own state, not the issue's current one."""
    ws_id = ws["workspace"]["id"]
    issue = create_issue(owner.client, ws["team"]["id"], assignee_id=member.id)
    qa_state = owner.client.post(
        f"/teams/{ws['team']['id']}/states",
        json={"name": "QA", "type": "started", "color": "#123456"},
    ).json()
    for state in (qa_state, ws["states"]["Done"]):
        response = owner.client.patch(
            f"/issues/{issue['id']}", json={"state_id": state["id"]}
        )
        assert response.status_code == 200, response.text

    newest, oldest = list_notifications(member.client, ws_id, type="status_changed")
    assert newest["state"]["name"] == "Done"
    assert oldest["state"] == {
        "id": qa_state["id"],
        "name": "QA",
        "type": "started",
        "color": "#123456",
    }
    assert oldest["issue"]["state"]["name"] == "Done"

    # Deleting that state leaves the notification without one.
    response = owner.client.delete(f"/workflow-states/{qa_state['id']}")
    assert response.status_code == 204, response.text
    _, oldest = list_notifications(member.client, ws_id, type="status_changed")
    assert oldest["state"] is None


def test_list_is_newest_first_filters_unread_and_lists_comments(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    ws_id = ws["workspace"]["id"]
    first = create_issue(owner.client, ws["team"]["id"], "First")
    second = create_issue(owner.client, ws["team"]["id"], "Second")
    owner.client.patch(f"/issues/{first['id']}", json={"assignee_id": member.id})
    owner.client.patch(f"/issues/{second['id']}", json={"assignee_id": member.id})
    # The comments feature writes "commented" rows into the table itself.
    db.execute(
        "INSERT INTO notification (id, user_id, workspace_id, issue_id, actor_id, "
        "type, created_at, updated_at) VALUES (gen_random_uuid(), %s, %s, %s, %s, "
        "'commented', now(), now())",
        (member.id, ws_id, first["id"], owner.id),
    )

    items = list_notifications(member.client, ws_id)
    assert [(n["type"], n["issue"]["title"]) for n in items] == [
        ("commented", "First"),
        ("assigned", "Second"),
        ("assigned", "First"),
    ]

    page = member.client.get(
        "/notifications", params={"workspace_id": ws_id, "size": 2, "page": 2}
    ).json()
    assert page["total"] == 3
    assert page["pages"] == 2
    assert [n["issue"]["title"] for n in page["items"]] == ["First"]

    response = member.client.patch(
        f"/notifications/{items[0]['id']}", json={"read": True}
    )
    assert response.status_code == 200, response.text
    assert response.json()["read_at"] is not None
    unread = list_notifications(member.client, ws_id, unread="true")
    assert [n["id"] for n in unread] == [items[1]["id"], items[2]["id"]]
    read = list_notifications(member.client, ws_id, unread="false")
    assert [n["id"] for n in read] == [items[0]["id"]]
    assert _count(member, ws_id) == 2

    typed = list_notifications(member.client, ws_id, type="commented")
    assert [n["id"] for n in typed] == [items[0]["id"]]


def test_mark_read_unread_archive_and_restore(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any]
) -> None:
    ws_id = ws["workspace"]["id"]
    create_issue(owner.client, ws["team"]["id"], assignee_id=member.id)
    [notification] = list_notifications(member.client, ws_id)
    url = f"/notifications/{notification['id']}"

    read = member.client.patch(url, json={"read": True}).json()
    assert read["read_at"] is not None
    # Read again: nothing changes, the time stays.
    assert member.client.patch(url, json={"read": True}).json() == read
    assert _count(member, ws_id) == 0

    unread = member.client.patch(url, json={"read": False}).json()
    assert unread["read_at"] is None
    assert _count(member, ws_id) == 1

    archived = member.client.patch(url, json={"archived": True}).json()
    assert archived["archived_at"] is not None
    assert list_notifications(member.client, ws_id) == []
    # Archived notifications are not counted.
    assert _count(member, ws_id) == 0
    with_archived = list_notifications(member.client, ws_id, include_archived="true")
    assert [n["id"] for n in with_archived] == [notification["id"]]

    restored = member.client.patch(url, json={"archived": False}).json()
    assert restored["archived_at"] is None
    assert len(list_notifications(member.client, ws_id)) == 1

    assert member.client.patch(url, json={}).status_code == 200


def test_mark_all_read(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    ws_id = ws["workspace"]["id"]
    for title in ("A", "B", "C"):
        create_issue(owner.client, ws["team"]["id"], title, assignee_id=member.id)
    # A notification in another workspace stays unread.
    other_ws = create_workspace(owner.client)
    other_team = workspace_team(owner.client, other_ws["id"])
    join_workspace(db, other_ws["id"], member.id)
    create_issue(owner.client, other_team["id"], assignee_id=member.id)

    assert _count(member, ws_id) == 3
    response = member.client.post(
        "/notifications/mark-all-read", json={"workspace_id": ws_id}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"updated": 3}
    assert _count(member, ws_id) == 0
    assert all(n["read_at"] for n in list_notifications(member.client, ws_id))

    assert _count(member, other_ws["id"]) == 1
    again = member.client.post(
        "/notifications/mark-all-read", json={"workspace_id": ws_id}
    )
    assert again.json() == {"updated": 0}


def test_delete_notification(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any]
) -> None:
    ws_id = ws["workspace"]["id"]
    create_issue(owner.client, ws["team"]["id"], assignee_id=member.id)
    [notification] = list_notifications(member.client, ws_id)

    response = member.client.delete(f"/notifications/{notification['id']}")
    assert response.status_code == 204, response.text
    assert list_notifications(member.client, ws_id, include_archived="true") == []
    assert_error(
        member.client.delete(f"/notifications/{notification['id']}"), 404, "not_found"
    )


def test_notifications_are_private_to_the_recipient(
    owner: RegisteredUser,
    member: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    ws_id = ws["workspace"]["id"]
    create_issue(owner.client, ws["team"]["id"], assignee_id=member.id)
    [notification] = list_notifications(member.client, ws_id)
    url = f"/notifications/{notification['id']}"

    # Another member of the same workspace.
    assert_error(owner.client.patch(url, json={"read": True}), 404, "not_found")
    assert_error(owner.client.delete(url), 404, "not_found")

    # A non-member cannot list or count the workspace.
    stranger = register_user()
    params = {"workspace_id": ws_id}
    assert_error(stranger.client.get("/notifications", params=params), 404, "not_found")
    assert_error(
        stranger.client.get("/notifications/unread-count", params=params),
        404,
        "not_found",
    )
    assert_error(
        stranger.client.post("/notifications/mark-all-read", json=params),
        404,
        "not_found",
    )
    assert_error(
        member.client.patch(f"/notifications/{uuid.uuid4()}", json={"read": True}),
        404,
        "not_found",
    )


def test_validation(member: RegisteredUser, ws: dict[str, Any]) -> None:
    ws_id = ws["workspace"]["id"]
    assert_error(member.client.get("/notifications"), 422, "validation_error")
    assert_error(
        member.client.get(
            "/notifications", params={"workspace_id": ws_id, "type": "nope"}
        ),
        422,
        "validation_error",
    )
    assert_error(
        member.client.get(
            "/notifications", params={"workspace_id": ws_id, "order_by": "metadata"}
        ),
        422,
        "validation_error",
    )
    assert_error(
        member.client.patch(f"/notifications/{uuid.uuid4()}", json={"read": None}),
        422,
        "validation_error",
    )
    assert_error(
        member.client.post("/notifications/mark-all-read", json={}),
        422,
        "validation_error",
    )
