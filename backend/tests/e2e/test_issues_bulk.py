"""POST /issues/bulk-update and /issues/bulk-delete, board moves, multi-value filters."""

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
    workspace_labels,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database


@pytest.fixture
def setup(register_user: Callable[..., RegisteredUser], db: Database) -> dict[str, Any]:
    owner = register_user(display_name="Owner")
    member = register_user(display_name="Member")
    workspace = create_workspace(owner.client)
    join_workspace(db, workspace["id"], member.id)
    team = workspace_team(owner.client, workspace["id"])
    states = team_states(owner.client, team["id"])
    labels = workspace_labels(owner.client, workspace["id"])
    issues = [
        create_issue(
            owner.client,
            team["id"],
            "First",
            label_ids=[labels["Bug"]["id"]],
        ),
        create_issue(owner.client, team["id"], "Second", priority=3),
        create_issue(member.client, team["id"], "Third", assignee_id=owner.id),
    ]
    return {
        "owner": owner,
        "member": member,
        "workspace": workspace,
        "team": team,
        "states": states,
        "labels": labels,
        "issues": issues,
    }


def _activity(db: Database, issue_id: str) -> list[tuple[Any, ...]]:
    return db.fetch_all(
        "SELECT action, field, from_value, to_value FROM issue_activity "
        "WHERE issue_id = %s ORDER BY created_at, field",
        (issue_id,),
    )


def test_bulk_update_changes_every_issue_and_logs_activity(
    setup: dict[str, Any], db: Database
) -> None:
    owner, states, labels = setup["owner"], setup["states"], setup["labels"]
    ids = [issue["id"] for issue in setup["issues"]]

    response = owner.client.post(
        "/issues/bulk-update",
        json={
            "issue_ids": ids,
            "update": {
                "state_id": states["In Progress"]["id"],
                "priority": 1,
                "assignee_id": setup["member"].id,
            },
        },
    )

    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [i["id"] for i in items] == ids
    for item in items:
        assert item["state"]["name"] == "In Progress"
        assert item["started_at"] is not None
        assert item["priority"] == 1
        assert item["assignee"]["name"] == "Member"
    assert ("updated", "state", "Todo", "In Progress") in _activity(db, ids[0])
    assert ("updated", "priority", "3", "1") in _activity(db, ids[1])
    assert ("updated", "assignee", "Owner", "Member") in _activity(db, ids[2])
    # The labels did not change.
    assert items[0]["labels"][0]["name"] == "Bug"
    assert labels


def test_bulk_update_adds_and_removes_labels(setup: dict[str, Any]) -> None:
    owner, labels = setup["owner"], setup["labels"]
    ids = [issue["id"] for issue in setup["issues"][:2]]

    response = owner.client.post(
        "/issues/bulk-update",
        json={
            "issue_ids": ids,
            "update": {
                "label_ids_add": [labels["Feature"]["id"]],
                "label_ids_remove": [labels["Bug"]["id"]],
            },
        },
    )

    assert response.status_code == 200, response.text
    assert [[lb["name"] for lb in i["labels"]] for i in response.json()["items"]] == [
        ["Feature"],
        ["Feature"],
    ]

    replaced = owner.client.post(
        "/issues/bulk-update",
        json={"issue_ids": ids, "update": {"label_ids": [], "assignee_id": None}},
    )
    assert replaced.status_code == 200
    assert all(i["labels"] == [] for i in replaced.json()["items"])


def test_bulk_update_with_no_change_and_archive(setup: dict[str, Any]) -> None:
    owner = setup["owner"]
    ids = [setup["issues"][0]["id"]]

    same = owner.client.post(
        "/issues/bulk-update", json={"issue_ids": ids, "update": {"priority": 0}}
    )
    assert same.status_code == 200
    assert same.json()["items"][0]["updated_at"] == setup["issues"][0]["updated_at"]

    archived = owner.client.post(
        "/issues/bulk-update", json={"issue_ids": ids, "update": {"archived": True}}
    )
    assert archived.json()["items"][0]["archived_at"] is not None
    listed = owner.client.get(
        "/issues", params={"workspace_id": setup["workspace"]["id"]}
    )
    assert ids[0] not in [i["id"] for i in listed.json()["items"]]


def test_bulk_update_is_all_or_nothing(setup: dict[str, Any]) -> None:
    owner = setup["owner"]
    other = create_workspace(owner.client, team_key="OPS")
    other_team = workspace_team(owner.client, other["id"])
    foreign = create_issue(owner.client, other_team["id"], "Other team")
    ids = [setup["issues"][0]["id"], foreign["id"]]

    # A state of ENG is not a state of OPS: nothing changes.
    response = owner.client.post(
        "/issues/bulk-update",
        json={
            "issue_ids": ids,
            "update": {"priority": 2, "state_id": setup["states"]["Done"]["id"]},
        },
    )

    assert_error(response, 400, "invalid_reference")
    first = owner.client.get(f"/issues/{ids[0]}").json()
    assert first["priority"] == 0
    assert first["state"]["name"] == "Todo"


def test_bulk_routes_hide_issues_of_other_workspaces(
    setup: dict[str, Any], register_user: Callable[..., RegisteredUser]
) -> None:
    stranger = register_user()
    ids = [setup["issues"][0]["id"]]

    assert_error(
        stranger.client.post(
            "/issues/bulk-update", json={"issue_ids": ids, "update": {"priority": 1}}
        ),
        404,
        "not_found",
    )
    assert_error(
        stranger.client.post("/issues/bulk-delete", json={"issue_ids": ids}),
        404,
        "not_found",
    )
    missing = [str(uuid.uuid4())]
    assert_error(
        setup["owner"].client.post("/issues/bulk-delete", json={"issue_ids": missing}),
        404,
        "not_found",
    )


@pytest.mark.parametrize(
    "body",
    [
        {"issue_ids": [], "update": {}},
        {"issue_ids": ["nope"], "update": {}},
        {"update": {"priority": 1}},
        {"issue_ids": [str(uuid.uuid4())], "update": {"priority": 9}},
        {"issue_ids": [str(uuid.uuid4())], "update": {"state_id": None}},
        {"issue_ids": [str(uuid.uuid4())], "update": {"priority": None}},
    ],
)
def test_bulk_update_validates_the_payload(
    setup: dict[str, Any], body: dict[str, Any]
) -> None:
    response = setup["owner"].client.post("/issues/bulk-update", json=body)

    assert_error(response, 422, "validation_error")


def test_bulk_delete(setup: dict[str, Any]) -> None:
    owner = setup["owner"]
    ids = [issue["id"] for issue in setup["issues"][:2]]

    response = owner.client.post("/issues/bulk-delete", json={"issue_ids": ids})

    assert response.status_code == 204
    for issue_id in ids:
        assert_error(owner.client.get(f"/issues/{issue_id}"), 404, "not_found")
    assert owner.client.get(f"/issues/{setup['issues'][2]['id']}").status_code == 200
    assert_error(
        owner.client.post("/issues/bulk-delete", json={"issue_ids": []}),
        422,
        "validation_error",
    )


def test_board_move_sets_state_and_sort_order_between_neighbours(
    setup: dict[str, Any],
) -> None:
    owner, states = setup["owner"], setup["states"]
    first, second, third = setup["issues"]

    # Drop "Third" between "First" and "Second" in the In Progress column.
    between = (first["sort_order"] + second["sort_order"]) / 2
    response = owner.client.patch(
        f"/issues/{third['id']}",
        json={"state_id": states["In Progress"]["id"], "sort_order": between},
    )

    assert response.status_code == 200
    assert response.json()["sort_order"] == between
    listed = owner.client.get(
        "/issues", params={"workspace_id": setup["workspace"]["id"]}
    )
    assert [i["title"] for i in listed.json()["items"]] == ["First", "Third", "Second"]


def _titles(setup: dict[str, Any], **params: Any) -> list[str]:
    response = setup["owner"].client.get(
        "/issues", params={"workspace_id": setup["workspace"]["id"], **params}
    )
    assert response.status_code == 200, response.text
    return [issue["title"] for issue in response.json()["items"]]


def test_multi_value_filters(setup: dict[str, Any]) -> None:
    owner, member, labels = setup["owner"], setup["member"], setup["labels"]

    assert _titles(setup, assignee_id__in=f"{owner.id},none") == [
        "First",
        "Second",
        "Third",
    ]
    assert _titles(setup, assignee_id__in="me") == ["Third"]
    assert _titles(setup, assignee_id__in="none") == ["First", "Second"]
    assert _titles(setup, creator_id__in=member.id) == ["Third"]
    assert _titles(setup, creator_id__in="me") == ["First", "Second"]
    assert _titles(
        setup, label_id__in=f"{labels['Bug']['id']},{labels['Feature']['id']}"
    ) == ["First"]
    assert _titles(setup, project_id__in="none") == ["First", "Second", "Third"]
    assert _titles(setup, project_id__in=str(uuid.uuid4())) == []
    assert _titles(setup, cycle_id__in=f"none,{uuid.uuid4()}") == [
        "First",
        "Second",
        "Third",
    ]
    assert _titles(setup, order_by="-updated_at,due_date")


@pytest.mark.parametrize(
    "params",
    [
        {"assignee_id__in": "someone"},
        {"creator_id__in": "none"},
        {"label_id__in": "x"},
        {"project_id__in": "x"},
        {"cycle_id__in": "x"},
    ],
)
def test_invalid_multi_value_filters_are_422(
    setup: dict[str, Any], params: dict[str, str]
) -> None:
    response = setup["owner"].client.get(
        "/issues", params={"workspace_id": setup["workspace"]["id"], **params}
    )

    assert_error(response, 422, "validation_error")
