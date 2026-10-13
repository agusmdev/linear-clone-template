"""Issues: create (numbering, defaults, references), get, by identifier, update, delete.

Workspace membership is the access rule: a non-member gets the 404 of a
missing issue. Every changed field writes one row of issue history.
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_issue,
    create_workspace,
    join_workspace,
    team_states,
    workspace_labels,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    import httpx

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database

ISSUE_FIELDS = {
    "id",
    "workspace_id",
    "team_id",
    "number",
    "identifier",
    "title",
    "description",
    "state_id",
    "priority",
    "assignee_id",
    "creator_id",
    "project_id",
    "cycle_id",
    "parent_id",
    "estimate",
    "due_date",
    "sort_order",
    "started_at",
    "completed_at",
    "canceled_at",
    "archived_at",
    "created_at",
    "updated_at",
    "team",
    "state",
    "assignee",
    "creator",
    "labels",
}


@pytest.fixture
def owner(register_user: Callable[..., RegisteredUser]) -> RegisteredUser:
    return register_user(display_name="Owner")


@pytest.fixture
def ws(owner: RegisteredUser) -> dict[str, Any]:
    """A workspace of ``owner`` with its team, states and labels."""
    workspace = create_workspace(owner.client)
    team = workspace_team(owner.client, workspace["id"])
    return {
        "workspace": workspace,
        "team": team,
        "states": team_states(owner.client, team["id"]),
        "labels": workspace_labels(owner.client, workspace["id"]),
    }


def _activity(db: Database, issue_id: str) -> list[tuple[Any, ...]]:
    # The activity list endpoint does not exist yet: read the history table.
    return db.fetch_all(
        "SELECT action::text, field, from_value, to_value FROM issue_activity "
        "WHERE issue_id = %s ORDER BY created_at, field",
        (issue_id,),
    )


def test_create_issue_with_defaults(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    response = owner.client.post(
        "/issues", json={"team_id": ws["team"]["id"], "title": "First bug"}
    )

    assert response.status_code == 201, response.text
    issue = response.json()
    assert set(issue) == ISSUE_FIELDS
    assert issue["number"] == 1
    assert issue["identifier"] == "ENG-1"
    assert issue["title"] == "First bug"
    assert issue["description"] is None
    assert issue["priority"] == 0
    assert issue["workspace_id"] == ws["workspace"]["id"]
    todo = ws["states"]["Todo"]
    assert issue["state"] == {k: todo[k] for k in ("id", "name", "type", "color")}
    assert issue["team"] == {
        "id": ws["team"]["id"],
        "key": "ENG",
        "name": "Engineering",
    }
    assert issue["creator"] == {"id": owner.id, "name": "Owner", "email": owner.email}
    assert issue["creator_id"] == owner.id
    assert issue["assignee"] is None
    assert issue["labels"] == []
    assert issue["started_at"] is None
    assert datetime.fromisoformat(issue["created_at"]).tzinfo is not None
    assert owner.client.get(f"/issues/{issue['id']}").json() == issue


def test_create_issue_with_every_field(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    parent = create_issue(owner.client, ws["team"]["id"], "Parent")
    bug, feature = ws["labels"]["Bug"], ws["labels"]["Feature"]

    issue = create_issue(
        owner.client,
        ws["team"]["id"],
        "Child",
        description="<p>Steps</p>",
        state_id=ws["states"]["In Progress"]["id"],
        priority=1,
        assignee_id=owner.id,
        label_ids=[feature["id"], bug["id"]],
        parent_id=parent["id"],
        estimate=3,
        due_date="2026-12-31",
        sort_order=-5.5,
    )

    assert issue["identifier"] == "ENG-2"
    assert issue["description"] == "<p>Steps</p>"
    assert issue["state"]["name"] == "In Progress"
    assert issue["started_at"] is not None
    assert issue["priority"] == 1
    assert issue["assignee"]["id"] == owner.id
    assert [label["name"] for label in issue["labels"]] == ["Bug", "Feature"]
    assert issue["parent_id"] == parent["id"]
    assert issue["estimate"] == 3
    assert issue["due_date"] == "2026-12-31"
    assert issue["sort_order"] == -5.5
    assert _activity(db, issue["id"]) == [("created", None, None, None)]


def test_numbers_increase_per_team_and_sort_order_appends(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    first = create_issue(owner.client, ws["team"]["id"], "A")
    second = create_issue(owner.client, ws["team"]["id"], "B")
    other_ws = create_workspace(owner.client, team_key="OPS")
    other = create_issue(
        owner.client, workspace_team(owner.client, other_ws["id"])["id"], "C"
    )

    assert [first["identifier"], second["identifier"]] == ["ENG-1", "ENG-2"]
    assert other["identifier"] == "OPS-1"
    assert second["sort_order"] > first["sort_order"]


def test_concurrent_creates_get_distinct_numbers(
    owner: RegisteredUser,
    ws: dict[str, Any],
    make_client: Callable[..., httpx.Client],
) -> None:
    clients = [make_client(owner.session_id) for _ in range(8)]

    def create(client: httpx.Client) -> int:
        return create_issue(client, ws["team"]["id"], "Race")["number"]

    with ThreadPoolExecutor(max_workers=8) as pool:
        numbers = list(pool.map(create, clients))

    assert sorted(numbers) == list(range(1, 9))


@pytest.mark.parametrize(
    ("state", "stamps"),
    [
        ("Backlog", (False, False, False)),
        ("In Review", (True, False, False)),
        ("Done", (False, True, False)),
        ("Canceled", (False, False, True)),
    ],
)
def test_create_in_a_state_sets_its_timestamp(
    owner: RegisteredUser,
    ws: dict[str, Any],
    state: str,
    stamps: tuple[bool, bool, bool],
) -> None:
    issue = create_issue(
        owner.client, ws["team"]["id"], state_id=ws["states"][state]["id"]
    )

    assert (
        issue["started_at"] is not None,
        issue["completed_at"] is not None,
        issue["canceled_at"] is not None,
    ) == stamps


def test_issue_title_is_saved_on_one_line(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    # A pasted multi-line title is stored as one line, on create and on update.
    issue = create_issue(owner.client, ws["team"]["id"], title="multi\nline title")
    assert issue["title"] == "multi line title"

    response = owner.client.patch(
        f"/issues/{issue['id']}", json={"title": " first \r\n\n  second\u2028third "}
    )

    assert response.status_code == 200, response.text
    assert response.json()["title"] == "first second third"
    assert owner.client.get(f"/issues/{issue['id']}").json()["title"] == (
        "first second third"
    )


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "title"),
        ({"title": ""}, "title"),
        ({"title": "\n\r\n"}, "title"),
        ({"title": "   "}, "title"),
        ({"title": " \t\n "}, "title"),
        ({"title": "x" * 501}, "title"),
        ({"title": "ok", "priority": 5}, "priority"),
        ({"title": "ok", "priority": -1}, "priority"),
        ({"title": "ok", "estimate": -1}, "estimate"),
        ({"title": "ok", "due_date": "tomorrow"}, "due_date"),
        ({"title": "ok", "label_ids": ["nope"]}, "label_ids"),
    ],
)
def test_create_issue_validates_the_payload(
    owner: RegisteredUser, ws: dict[str, Any], payload: dict[str, Any], field: str
) -> None:
    response = owner.client.post(
        "/issues", json={"team_id": ws["team"]["id"], **payload}
    )

    body = assert_error(response, 422, "validation_error")
    assert [issue["loc"][:2] for issue in body["detail"]] == [["body", field]]


def test_title_whitespace_is_trimmed(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    issue = create_issue(owner.client, ws["team"]["id"], "  Padded title  ")
    assert issue["title"] == "Padded title"

    response = owner.client.patch(
        f"/issues/{issue['id']}", json={"title": "\tRenamed \n"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Renamed"
    blank = owner.client.patch(f"/issues/{issue['id']}", json={"title": "   "})
    assert_error(blank, 422, "validation_error")
    assert owner.client.get(f"/issues/{issue['id']}").json()["title"] == "Renamed"


def test_create_issue_refuses_references_outside_the_workspace(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    other_ws = create_workspace(owner.client, team_key="OPS")
    other_team = workspace_team(owner.client, other_ws["id"])
    other_state = team_states(owner.client, other_team["id"])["Todo"]
    other_label = workspace_labels(owner.client, other_ws["id"])["Bug"]
    other_issue = create_issue(owner.client, other_team["id"])
    stranger = register_user()

    for extra in (
        {"state_id": other_state["id"]},
        {"label_ids": [other_label["id"]]},
        {"assignee_id": stranger.id},
        {"parent_id": other_issue["id"]},
        {"project_id": str(uuid.uuid4())},
        {"cycle_id": str(uuid.uuid4())},
    ):
        response = owner.client.post(
            "/issues", json={"team_id": ws["team"]["id"], "title": "x", **extra}
        )
        assert_error(response, 400, "invalid_reference")

    listed = owner.client.get("/issues", params={"workspace_id": ws["workspace"]["id"]})
    assert listed.json()["total"] == 0


def test_a_non_member_cannot_create_read_change_or_delete(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"])
    stranger = register_user().client
    workspace_id = ws["workspace"]["id"]

    assert_error(
        stranger.post("/issues", json={"team_id": ws["team"]["id"], "title": "x"}),
        404,
        "not_found",
    )
    assert_error(stranger.get(f"/issues/{issue['id']}"), 404, "not_found")
    assert_error(
        stranger.get(f"/workspaces/{workspace_id}/issues/by-identifier/ENG-1"),
        404,
        "not_found",
    )
    assert_error(
        stranger.get("/issues", params={"workspace_id": workspace_id}),
        404,
        "not_found",
    )
    assert_error(
        stranger.patch(f"/issues/{issue['id']}", json={"title": "Hacked"}),
        404,
        "not_found",
    )
    assert_error(stranger.delete(f"/issues/{issue['id']}"), 404, "not_found")
    assert owner.client.get(f"/issues/{issue['id']}").json()["title"] == issue["title"]


def test_get_issue_by_identifier(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    create_issue(owner.client, ws["team"]["id"], "One")
    two = create_issue(owner.client, ws["team"]["id"], "Two")
    base = f"/workspaces/{ws['workspace']['id']}/issues/by-identifier"

    response = owner.client.get(f"{base}/ENG-2")

    assert response.status_code == 200
    assert response.json() == two
    assert owner.client.get(f"{base}/eng-2").json()["id"] == two["id"]
    for missing in ("ENG-3", "OPS-1", "ENG", "12", "ENG-x"):
        assert_error(owner.client.get(f"{base}/{missing}"), 404, "not_found")


def test_get_unknown_issue_is_404(auth_client: httpx.Client) -> None:
    assert_error(auth_client.get(f"/issues/{uuid.uuid4()}"), 404, "not_found")


def test_update_fields_and_log_activity(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"], "Old", priority=0)

    response = owner.client.patch(
        f"/issues/{issue['id']}",
        json={
            "title": "New",
            "priority": 2,
            "description": "<p>Body</p>",
            "estimate": 5,
            "due_date": "2027-01-15",
            "sort_order": 42.0,
        },
    )

    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["title"] == "New"
    assert updated["priority"] == 2
    assert updated["description"] == "<p>Body</p>"
    assert updated["estimate"] == 5
    assert updated["due_date"] == "2027-01-15"
    assert updated["sort_order"] == 42.0
    assert updated["updated_at"] > issue["updated_at"]
    assert owner.client.get(f"/issues/{issue['id']}").json() == updated
    assert sorted(_activity(db, issue["id"])[1:], key=str) == sorted(
        [
            ("updated", "title", "Old", "New"),
            ("updated", "priority", "0", "2"),
            ("updated", "description", None, None),
            ("updated", "estimate", None, "5"),
            ("updated", "due_date", None, "2027-01-15"),
        ],
        key=str,
    )


def test_update_with_the_same_values_changes_nothing(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"], "Same", priority=3)

    response = owner.client.patch(
        f"/issues/{issue['id']}", json={"title": "Same", "priority": 3, "label_ids": []}
    )

    assert response.status_code == 200
    assert response.json() == issue
    assert len(_activity(db, issue["id"])) == 1


def test_state_changes_set_and_clear_timestamps(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    states = ws["states"]
    issue = create_issue(owner.client, ws["team"]["id"])

    def move(state: str) -> dict[str, Any]:
        response = owner.client.patch(
            f"/issues/{issue['id']}", json={"state_id": states[state]["id"]}
        )
        assert response.status_code == 200, response.text
        return response.json()

    started = move("In Progress")
    assert started["started_at"] is not None
    assert started["state"]["name"] == "In Progress"
    done = move("Done")
    assert done["completed_at"] is not None
    assert done["started_at"] == started["started_at"]
    canceled = move("Canceled")
    assert canceled["canceled_at"] is not None
    assert canceled["completed_at"] is None
    back = move("Todo")
    assert (back["started_at"], back["completed_at"], back["canceled_at"]) == (
        None,
        None,
        None,
    )
    assert [row for row in _activity(db, issue["id"]) if row[1] == "state"] == [
        ("updated", "state", "Todo", "In Progress"),
        ("updated", "state", "In Progress", "Done"),
        ("updated", "state", "Done", "Canceled"),
        ("updated", "state", "Canceled", "Todo"),
    ]


def test_update_assignee_and_labels(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
    db: Database,
) -> None:
    member = register_user(display_name="Member")
    join_workspace(db, ws["workspace"]["id"], member.id)
    labels = ws["labels"]
    issue = create_issue(
        owner.client, ws["team"]["id"], label_ids=[labels["Bug"]["id"]]
    )

    response = owner.client.patch(
        f"/issues/{issue['id']}",
        json={
            "assignee_id": member.id,
            "label_ids": [labels["Improvement"]["id"], labels["Feature"]["id"]],
        },
    )

    updated = response.json()
    assert updated["assignee"] == {
        "id": member.id,
        "name": "Member",
        "email": member.email,
    }
    assert [label["name"] for label in updated["labels"]] == ["Feature", "Improvement"]
    # The new assignee is subscribed and sees the issue in "subscribed".
    subscribed = member.client.get(
        "/issues",
        params={"workspace_id": ws["workspace"]["id"], "subscriber_id": "me"},
    )
    assert [i["id"] for i in subscribed.json()["items"]] == [issue["id"]]

    unassigned = owner.client.patch(
        f"/issues/{issue['id']}", json={"assignee_id": None, "label_ids": []}
    ).json()
    assert unassigned["assignee"] is None
    assert unassigned["labels"] == []
    rows = [row for row in _activity(db, issue["id"]) if row[0] == "updated"]
    assert sorted(rows, key=str) == sorted(
        [
            ("updated", "assignee", None, "Member"),
            ("updated", "labels", "Bug", "Feature, Improvement"),
            ("updated", "assignee", "Member", None),
            ("updated", "labels", "Feature, Improvement", None),
        ],
        key=str,
    )


def test_update_refuses_invalid_references(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    other_ws = create_workspace(owner.client, team_key="OPS")
    other_team = workspace_team(owner.client, other_ws["id"])
    issue = create_issue(owner.client, ws["team"]["id"])
    child = create_issue(owner.client, ws["team"]["id"], parent_id=issue["id"])

    for payload in (
        {"state_id": team_states(owner.client, other_team["id"])["Todo"]["id"]},
        {"assignee_id": register_user().id},
        {"label_ids": [workspace_labels(owner.client, other_ws["id"])["Bug"]["id"]]},
        {"parent_id": issue["id"]},
        {"parent_id": child["id"]},
        {"project_id": str(uuid.uuid4())},
        {"cycle_id": str(uuid.uuid4())},
    ):
        response = owner.client.patch(f"/issues/{issue['id']}", json=payload)
        assert_error(response, 400, "invalid_reference")
    assert owner.client.get(f"/issues/{issue['id']}").json() == issue


def test_update_parent_and_archive(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    parent = create_issue(owner.client, ws["team"]["id"], "Parent")
    issue = create_issue(owner.client, ws["team"]["id"], "Child")

    with_parent = owner.client.patch(
        f"/issues/{issue['id']}", json={"parent_id": parent["id"]}
    ).json()
    assert with_parent["parent_id"] == parent["id"]

    archived = owner.client.patch(
        f"/issues/{issue['id']}", json={"archived": True}
    ).json()
    assert archived["archived_at"] is not None
    restored = owner.client.patch(
        f"/issues/{issue['id']}", json={"archived": False, "parent_id": None}
    ).json()
    assert restored["archived_at"] is None
    assert restored["parent_id"] is None
    actions = [(row[0], row[1], row[3]) for row in _activity(db, issue["id"])]
    assert ("updated", "parent", "ENG-1") in actions
    assert ("archived", None, None) in actions
    assert ("unarchived", None, None) in actions


@pytest.mark.parametrize(
    "payload",
    [
        {"title": None},
        {"title": ""},
        {"title": "   "},
        {"state_id": None},
        {"priority": None},
        {"priority": 9},
        {"label_ids": None},
        {"archived": None},
        {"sort_order": None},
    ],
)
def test_update_validates_the_payload(
    owner: RegisteredUser, ws: dict[str, Any], payload: dict[str, Any]
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"])

    response = owner.client.patch(f"/issues/{issue['id']}", json=payload)

    assert_error(response, 422, "validation_error")


def test_delete_issue(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    parent = create_issue(owner.client, ws["team"]["id"])
    child = create_issue(owner.client, ws["team"]["id"], parent_id=parent["id"])

    response = owner.client.delete(f"/issues/{parent['id']}")

    assert response.status_code == 204
    assert_error(owner.client.get(f"/issues/{parent['id']}"), 404, "not_found")
    assert owner.client.get(f"/issues/{child['id']}").json()["parent_id"] is None
    assert_error(owner.client.delete(f"/issues/{parent['id']}"), 404, "not_found")


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/issues"),
        ("GET", "/issues"),
        ("GET", f"/issues/{uuid.UUID(int=1)}"),
        ("PATCH", f"/issues/{uuid.UUID(int=1)}"),
        ("DELETE", f"/issues/{uuid.UUID(int=1)}"),
        ("GET", f"/workspaces/{uuid.UUID(int=1)}/issues/by-identifier/ENG-1"),
    ],
)
def test_issue_routes_need_authentication(
    api: httpx.Client, method: str, path: str
) -> None:
    response = api.request(method, path, json={})

    assert_error(response, 403, "http_error", "Not authenticated")
