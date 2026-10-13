"""Issue detail: comments, relations, activity, subscribers, sub-issues.

Workspace membership is the access rule: a non-member gets the 404 of a
missing issue. Comments can be edited and deleted only by their author.
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
    team_states,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    import httpx

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database


@pytest.fixture
def owner(register_user: Callable[..., RegisteredUser]) -> RegisteredUser:
    return register_user(display_name="Owner")


@pytest.fixture
def member(
    register_user: Callable[..., RegisteredUser],
    ws: dict[str, Any],
    db: Database,
) -> RegisteredUser:
    user = register_user(display_name="Member")
    join_workspace(db, ws["workspace"]["id"], user.id)
    return user


@pytest.fixture
def outsider(register_user: Callable[..., RegisteredUser]) -> RegisteredUser:
    return register_user(display_name="Outsider")


@pytest.fixture
def ws(owner: RegisteredUser) -> dict[str, Any]:
    workspace = create_workspace(owner.client)
    team = workspace_team(owner.client, workspace["id"])
    return {
        "workspace": workspace,
        "team": team,
        "states": team_states(owner.client, team["id"]),
    }


def _notifications(db: Database, issue_id: str) -> list[tuple[str, str, str]]:
    rows = db.fetch_all(
        "SELECT user_id::text, actor_id::text, type::text FROM notification "
        "WHERE issue_id = %s ORDER BY created_at",
        (issue_id,),
    )
    return [tuple(row) for row in rows]


def _subscriber_ids(client: httpx.Client, issue_id: str) -> set[str]:
    response = client.get(f"/issues/{issue_id}/subscribers")
    assert response.status_code == 200, response.text
    return {user["id"] for user in response.json()}


# --- Comments -------------------------------------------------------------------


def test_comment_lifecycle(
    owner: RegisteredUser, member: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"], "Commented")

    created = member.client.post(
        f"/issues/{issue['id']}/comments", json={"body": "<p>First!</p>"}
    )

    assert created.status_code == 201, created.text
    comment = created.json()
    assert set(comment) == {
        "id",
        "issue_id",
        "user_id",
        "user",
        "body",
        "edited_at",
        "created_at",
        "updated_at",
    }
    assert comment["issue_id"] == issue["id"]
    assert comment["user"] == {
        "id": member.id,
        "name": "Member",
        "email": member.email,
    }
    assert comment["body"] == "<p>First!</p>"
    assert comment["edited_at"] is None
    # The author is subscribed; the creator (a subscriber) is notified.
    assert _subscriber_ids(owner.client, issue["id"]) == {owner.id, member.id}
    assert _notifications(db, issue["id"]) == [(owner.id, member.id, "commented")]

    second = owner.client.post(
        f"/issues/{issue['id']}/comments", json={"body": "<p>Second</p>"}
    ).json()
    # Owner comments: only the member is notified (never the author).
    assert _notifications(db, issue["id"])[1:] == [(member.id, owner.id, "commented")]

    listed = owner.client.get(f"/issues/{issue['id']}/comments")
    assert listed.status_code == 200
    assert [c["id"] for c in listed.json()] == [comment["id"], second["id"]]

    edited = member.client.patch(
        f"/comments/{comment['id']}", json={"body": "<p>Edited</p>"}
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["body"] == "<p>Edited</p>"
    assert edited.json()["edited_at"] is not None

    activity = owner.client.get(f"/issues/{issue['id']}/activity").json()
    assert [a["action"] for a in activity] == ["created", "commented", "commented"]
    assert activity[1]["actor"]["name"] == "Member"

    deleted = member.client.delete(f"/comments/{comment['id']}")
    assert deleted.status_code == 204
    remaining = owner.client.get(f"/issues/{issue['id']}/comments").json()
    assert [c["id"] for c in remaining] == [second["id"]]


def test_same_body_edit_keeps_edited_at_empty(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"])
    comment = owner.client.post(
        f"/issues/{issue['id']}/comments", json={"body": "<p>Same</p>"}
    ).json()

    response = owner.client.patch(
        f"/comments/{comment['id']}", json={"body": "<p>Same</p>"}
    )

    assert response.status_code == 200
    assert response.json()["edited_at"] is None


def test_only_the_author_edits_or_deletes_a_comment(
    owner: RegisteredUser,
    member: RegisteredUser,
    outsider: RegisteredUser,
    ws: dict[str, Any],
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"])
    comment = owner.client.post(
        f"/issues/{issue['id']}/comments", json={"body": "<p>Mine</p>"}
    ).json()
    path = f"/comments/{comment['id']}"

    for client in (member.client, outsider.client):
        assert_error(client.patch(path, json={"body": "x"}), 404, "not_found")
        assert_error(client.delete(path), 404, "not_found")
    assert_error(owner.client.delete(f"/comments/{uuid.uuid4()}"), 404, "not_found")
    assert owner.client.get(f"/issues/{issue['id']}/comments").json()[0]["body"] == (
        "<p>Mine</p>"
    )


def test_comment_validation(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    issue = create_issue(owner.client, ws["team"]["id"])

    for body in ({}, {"body": ""}, {"body": "x" * 100_001}):
        response = owner.client.post(f"/issues/{issue['id']}/comments", json=body)
        assert_error(response, 422, "validation_error")


# --- Relations ------------------------------------------------------------------


def test_relations_both_directions(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    team_id = ws["team"]["id"]
    a = create_issue(owner.client, team_id, "A")
    b = create_issue(owner.client, team_id, "B")
    c = create_issue(owner.client, team_id, "C")
    d = create_issue(owner.client, team_id, "D")

    blocks = owner.client.post(
        f"/issues/{a['id']}/relations",
        json={"related_issue_id": b["id"], "type": "blocks"},
    )
    assert blocks.status_code == 201, blocks.text
    assert blocks.json()["type"] == "blocks"
    assert blocks.json()["direction"] == "outgoing"
    assert blocks.json()["issue"] == {
        "id": b["id"],
        "identifier": b["identifier"],
        "title": "B",
        "state": b["state"],
    }

    blocked_by = owner.client.post(
        f"/issues/{a['id']}/relations",
        json={"related_issue_id": c["id"], "type": "blocked_by"},
    ).json()
    assert (blocked_by["type"], blocked_by["direction"]) == ("blocks", "incoming")
    related = owner.client.post(
        f"/issues/{a['id']}/relations",
        json={"related_issue_id": d["id"], "type": "related"},
    ).json()
    duplicate = owner.client.post(
        f"/issues/{d['id']}/relations",
        json={"related_issue_id": a["id"], "type": "duplicate"},
    ).json()

    listed = owner.client.get(f"/issues/{a['id']}/relations")
    assert listed.status_code == 200
    assert [
        (r["type"], r["direction"], r["issue"]["title"]) for r in listed.json()
    ] == [
        ("blocks", "outgoing", "B"),
        ("blocks", "incoming", "C"),
        ("related", "outgoing", "D"),
        ("duplicate", "incoming", "D"),
    ]
    # Seen from B, A blocks it.
    from_b = owner.client.get(f"/issues/{b['id']}/relations").json()
    assert [(r["direction"], r["issue"]["id"]) for r in from_b] == [
        ("incoming", a["id"])
    ]

    assert owner.client.delete(f"/issue-relations/{related['id']}").status_code == 204
    assert owner.client.delete(f"/issue-relations/{duplicate['id']}").status_code == (
        204
    )
    remaining = owner.client.get(f"/issues/{a['id']}/relations").json()
    assert [r["issue"]["title"] for r in remaining] == ["B", "C"]


def test_relation_errors(
    owner: RegisteredUser, outsider: RegisteredUser, ws: dict[str, Any]
) -> None:
    a = create_issue(owner.client, ws["team"]["id"], "A")
    b = create_issue(owner.client, ws["team"]["id"], "B")
    other_ws = create_workspace(outsider.client)
    foreign = create_issue(
        outsider.client, workspace_team(outsider.client, other_ws["id"])["id"]
    )
    path = f"/issues/{a['id']}/relations"

    assert_error(
        owner.client.post(path, json={"related_issue_id": a["id"], "type": "related"}),
        400,
        "invalid_reference",
    )
    assert_error(
        owner.client.post(
            path, json={"related_issue_id": foreign["id"], "type": "related"}
        ),
        400,
        "invalid_reference",
    )
    assert_error(
        owner.client.post(path, json={"related_issue_id": b["id"], "type": "parent"}),
        422,
        "validation_error",
    )
    created = owner.client.post(
        path, json={"related_issue_id": b["id"], "type": "related"}
    ).json()
    # The same relation again, either way, is a duplicate.
    assert_error(
        owner.client.post(
            f"/issues/{b['id']}/relations",
            json={"related_issue_id": a["id"], "type": "related"},
        ),
        400,
        "duplicate_item",
    )
    assert_error(outsider.client.get(path), 404, "not_found")
    assert_error(
        outsider.client.delete(f"/issue-relations/{created['id']}"), 404, "not_found"
    )
    assert_error(
        owner.client.delete(f"/issue-relations/{uuid.uuid4()}"), 404, "not_found"
    )


# --- Activity -------------------------------------------------------------------


def test_activity_has_readable_values(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"], "History")
    owner.client.patch(
        f"/issues/{issue['id']}",
        json={"state_id": ws["states"]["In Progress"]["id"], "priority": 2},
    )
    owner.client.patch(f"/issues/{issue['id']}", json={"archived": True})
    owner.client.patch(f"/issues/{issue['id']}", json={"archived": False})

    response = owner.client.get(f"/issues/{issue['id']}/activity")

    assert response.status_code == 200
    rows = response.json()
    assert set(rows[0]) == {
        "id",
        "issue_id",
        "actor_id",
        "actor",
        "action",
        "field",
        "from_value",
        "to_value",
        "created_at",
    }
    assert rows[0]["actor"] == {"id": owner.id, "name": "Owner", "email": owner.email}
    assert sorted(
        (r["action"], r["field"], r["from_value"], r["to_value"]) for r in rows[1:3]
    ) == [
        ("updated", "priority", "0", "2"),
        ("updated", "state", "Todo", "In Progress"),
    ]
    assert [r["action"] for r in rows] == [
        "created",
        "updated",
        "updated",
        "archived",
        "unarchived",
    ]


def _changes(client: httpx.Client, issue_id: str) -> list[tuple[Any, ...]]:
    """(field, from_value, to_value) of each ``updated`` activity row, in order."""
    rows = client.get(f"/issues/{issue_id}/activity").json()
    return [
        (r["field"], r["from_value"], r["to_value"])
        for r in rows
        if r["action"] == "updated"
    ]


def test_relation_changes_are_logged_on_both_issues(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    team_id = ws["team"]["id"]
    a, b, c, d, e = (create_issue(owner.client, team_id, t) for t in "ABCDE")
    created = {}
    for other, kind in (
        (b, "blocked_by"),
        (c, "blocks"),
        (d, "related"),
        (e, "duplicate"),
    ):
        response = owner.client.post(
            f"/issues/{a['id']}/relations",
            json={"related_issue_id": other["id"], "type": kind},
        )
        assert response.status_code == 201, response.text
        created[kind] = response.json()
    response = owner.client.delete(f"/issue-relations/{created['related']['id']}")
    assert response.status_code == 204

    assert _changes(owner.client, a["id"]) == [
        ("relation_blocked_by", None, b["identifier"]),
        ("relation_blocks", None, c["identifier"]),
        ("relation_related", None, d["identifier"]),
        ("relation_duplicate_of", None, e["identifier"]),
        ("relation_related", d["identifier"], None),
    ]
    assert _changes(owner.client, b["id"]) == [
        ("relation_blocks", None, a["identifier"])
    ]
    assert _changes(owner.client, c["id"]) == [
        ("relation_blocked_by", None, a["identifier"])
    ]
    assert _changes(owner.client, d["id"]) == [
        ("relation_related", None, a["identifier"]),
        ("relation_related", a["identifier"], None),
    ]
    assert _changes(owner.client, e["id"]) == [
        ("relation_duplicated_by", None, a["identifier"])
    ]


def test_sub_issue_changes_are_logged_on_parent_and_child(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    team_id = ws["team"]["id"]
    parent = create_issue(owner.client, team_id, "Parent")
    other = create_issue(owner.client, team_id, "Other parent")
    child = create_issue(owner.client, team_id, "Child A", parent_id=parent["id"])

    child_rows = owner.client.get(f"/issues/{child['id']}/activity").json()
    assert [r["action"] for r in child_rows] == ["created", "updated"]
    assert _changes(owner.client, child["id"]) == [
        ("parent", None, parent["identifier"])
    ]
    assert _changes(owner.client, parent["id"]) == [
        ("sub_issue", None, child["identifier"])
    ]

    # Moving the child to another parent logs on both parents.
    response = owner.client.patch(
        f"/issues/{child['id']}", json={"parent_id": other["id"]}
    )
    assert response.status_code == 200, response.text
    assert _changes(owner.client, parent["id"])[-1] == (
        "sub_issue",
        child["identifier"],
        None,
    )
    assert _changes(owner.client, other["id"]) == [
        ("sub_issue", None, child["identifier"])
    ]

    # Clearing the parent logs on the child and on the old parent.
    response = owner.client.patch(f"/issues/{child['id']}", json={"parent_id": None})
    assert response.status_code == 200, response.text
    assert _changes(owner.client, child["id"])[-1] == (
        "parent",
        other["identifier"],
        None,
    )
    assert _changes(owner.client, other["id"])[-1] == (
        "sub_issue",
        child["identifier"],
        None,
    )


# --- Subscribers ----------------------------------------------------------------


def test_subscribe_and_unsubscribe(
    owner: RegisteredUser,
    member: RegisteredUser,
    outsider: RegisteredUser,
    ws: dict[str, Any],
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"])
    path = f"/issues/{issue['id']}/subscribers"
    listed = owner.client.get(path)
    assert listed.json() == [{"id": owner.id, "name": "Owner", "email": owner.email}]

    assert member.client.post(path, json={}).status_code == 204
    # Idempotent.
    assert member.client.post(path).status_code == 204
    assert _subscriber_ids(owner.client, issue["id"]) == {owner.id, member.id}

    assert member.client.delete(f"{path}/me").status_code == 204
    assert _subscriber_ids(owner.client, issue["id"]) == {owner.id}

    # Subscribe someone else, then remove them by id.
    assert owner.client.post(path, json={"user_id": member.id}).status_code == 204
    assert owner.client.delete(f"{path}/{member.id}").status_code == 204
    assert _subscriber_ids(owner.client, issue["id"]) == {owner.id}

    assert_error(
        owner.client.post(path, json={"user_id": outsider.id}),
        400,
        "invalid_reference",
    )
    assert_error(owner.client.delete(f"{path}/nobody"), 422, "validation_error")
    assert_error(outsider.client.get(path), 404, "not_found")
    assert_error(outsider.client.post(path, json={}), 404, "not_found")


# --- Sub-issues -----------------------------------------------------------------


def test_sub_issues_and_progress(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    team_id = ws["team"]["id"]
    parent = create_issue(owner.client, team_id, "Parent")
    done = create_issue(
        owner.client,
        team_id,
        "Done child",
        parent_id=parent["id"],
        state_id=ws["states"]["Done"]["id"],
    )
    todo = create_issue(owner.client, team_id, "Todo child", parent_id=parent["id"])
    archived = create_issue(owner.client, team_id, "Old", parent_id=parent["id"])
    owner.client.patch(f"/issues/{archived['id']}", json={"archived": True})

    response = owner.client.get(f"/issues/{parent['id']}/sub-issues")

    assert response.status_code == 200
    body = response.json()
    assert [i["id"] for i in body["items"]] == [done["id"], todo["id"]]
    assert body["items"][0]["state"]["type"] == "completed"
    assert (body["total"], body["completed"]) == (2, 1)
    empty = owner.client.get(f"/issues/{done['id']}/sub-issues").json()
    assert empty == {"items": [], "total": 0, "completed": 0}


# --- Access ---------------------------------------------------------------------


def test_a_non_member_gets_404_everywhere(
    owner: RegisteredUser, outsider: RegisteredUser, ws: dict[str, Any]
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"])
    base = f"/issues/{issue['id']}"

    for method, path in (
        ("GET", f"{base}/comments"),
        ("POST", f"{base}/comments"),
        ("GET", f"{base}/activity"),
        ("GET", f"{base}/sub-issues"),
        ("POST", f"{base}/relations"),
        ("DELETE", f"{base}/subscribers/me"),
    ):
        payload = (
            {"body": "x", "related_issue_id": str(uuid.uuid4()), "type": "related"}
            if method == "POST"
            else None
        )
        response = outsider.client.request(method, path, json=payload)
        assert_error(response, 404, "not_found")


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", f"/issues/{uuid.uuid4()}/comments"),
        ("POST", f"/issues/{uuid.uuid4()}/comments"),
        ("PATCH", f"/comments/{uuid.uuid4()}"),
        ("DELETE", f"/comments/{uuid.uuid4()}"),
        ("GET", f"/issues/{uuid.uuid4()}/relations"),
        ("POST", f"/issues/{uuid.uuid4()}/relations"),
        ("DELETE", f"/issue-relations/{uuid.uuid4()}"),
        ("GET", f"/issues/{uuid.uuid4()}/activity"),
        ("GET", f"/issues/{uuid.uuid4()}/subscribers"),
        ("POST", f"/issues/{uuid.uuid4()}/subscribers"),
        ("DELETE", f"/issues/{uuid.uuid4()}/subscribers/me"),
        ("GET", f"/issues/{uuid.uuid4()}/sub-issues"),
    ],
)
def test_issue_detail_routes_need_authentication(
    api: httpx.Client, method: str, path: str
) -> None:
    response = api.request(method, path, json={})

    assert_error(response, 403, "http_error", "Not authenticated")
