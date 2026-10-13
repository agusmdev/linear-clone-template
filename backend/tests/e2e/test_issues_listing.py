"""GET /issues: workspace scope, every filter, search, sort and pages."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_issue,
    create_team,
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
    """Two members, one workspace, and five issues with different properties.

    ENG-1 "Login crash"      Todo         urgent  assignee=owner  label Bug
    ENG-2 "Signup form"      In Progress  high    assignee=member label Feature
    ENG-3 "Docs typo"        Backlog      none    unassigned      (child of ENG-1)
    ENG-4 "Old idea"         Done         low     created by member
    ENG-5 "Archived thing"   Todo         medium  archived
    """
    owner = register_user(display_name="Owner")
    member = register_user(display_name="Member")
    workspace = create_workspace(owner.client)
    join_workspace(db, workspace["id"], member.id)
    team = workspace_team(owner.client, workspace["id"])
    states = team_states(owner.client, team["id"])
    labels = workspace_labels(owner.client, workspace["id"])
    team_id = team["id"]
    one = create_issue(
        owner.client,
        team_id,
        "Login crash",
        description="<p>Stack trace</p>",
        priority=1,
        assignee_id=owner.id,
        label_ids=[labels["Bug"]["id"]],
    )
    two = create_issue(
        owner.client,
        team_id,
        "Signup form",
        state_id=states["In Progress"]["id"],
        priority=2,
        assignee_id=member.id,
        label_ids=[labels["Feature"]["id"]],
    )
    three = create_issue(
        owner.client,
        team_id,
        "Docs typo",
        state_id=states["Backlog"]["id"],
        parent_id=one["id"],
    )
    four = create_issue(
        member.client, team_id, "Old idea", state_id=states["Done"]["id"], priority=4
    )
    five = create_issue(owner.client, team_id, "Archived thing", priority=3)
    archived = owner.client.patch(f"/issues/{five['id']}", json={"archived": True})
    assert archived.status_code == 200
    return {
        "owner": owner,
        "member": member,
        "workspace": workspace,
        "team": team,
        "states": states,
        "labels": labels,
        "issues": {
            "ENG-1": one,
            "ENG-2": two,
            "ENG-3": three,
            "ENG-4": four,
            "ENG-5": five,
        },
    }


def _identifiers(setup: dict[str, Any], who: str = "owner", **params: Any) -> list[str]:
    response = setup[who].client.get(
        "/issues", params={"workspace_id": setup["workspace"]["id"], **params}
    )
    assert response.status_code == 200, response.text
    return [issue["identifier"] for issue in response.json()["items"]]


def test_default_list_is_manual_order_without_archived(setup: dict[str, Any]) -> None:
    response = setup["owner"].client.get(
        "/issues", params={"workspace_id": setup["workspace"]["id"]}
    )

    body = response.json()
    assert set(body) == {"items", "total", "page", "size", "pages"}
    assert body["total"] == 4
    assert [i["identifier"] for i in body["items"]] == [
        "ENG-1",
        "ENG-2",
        "ENG-3",
        "ENG-4",
    ]
    first = body["items"][0]
    assert first["state"]["name"] == "Todo"
    assert first["labels"][0]["name"] == "Bug"
    assert first["assignee"]["name"] == "Owner"
    assert first["team"]["key"] == "ENG"


def test_include_archived(setup: dict[str, Any]) -> None:
    assert _identifiers(setup, include_archived="true")[-1] == "ENG-5"
    assert "ENG-5" not in _identifiers(setup, include_archived="false")


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"priority__in": "1,2"}, ["ENG-1", "ENG-2"]),
        ({"state_type__in": "backlog,completed"}, ["ENG-3", "ENG-4"]),
        ({"state_type__in": "started"}, ["ENG-2"]),
        ({"assignee_id": "me"}, ["ENG-1"]),
        ({"assignee_id": "none"}, ["ENG-3", "ENG-4"]),
        ({"parent_id__isnull": "false"}, ["ENG-3"]),
        ({"parent_id__isnull": "true"}, ["ENG-1", "ENG-2", "ENG-4"]),
        ({"search": "crash"}, ["ENG-1"]),
        ({"search": "STACK TRACE"}, ["ENG-1"]),
        # Every word, in any order, in the title or the description.
        ({"search": "crash login"}, ["ENG-1"]),
        ({"search": "trace login"}, ["ENG-1"]),
        ({"search": "login signup"}, []),
        ({"search": "ENG-2"}, ["ENG-2"]),
        ({"search": "4"}, ["ENG-4"]),
        ({"search": "nothing matches"}, []),
        ({"project_id": str(uuid.uuid4())}, []),
        ({"cycle_id": str(uuid.uuid4())}, []),
    ],
)
def test_filters(
    setup: dict[str, Any], params: dict[str, str], expected: list[str]
) -> None:
    assert _identifiers(setup, **params) == expected


@pytest.mark.parametrize(
    ("search", "expected"),
    [("%", ["ENG-6"]), ("_", ["ENG-7"]), ("\\", ["ENG-8"]), ("0%", ["ENG-6"])],
)
def test_search_treats_like_wildcards_as_literal_text(
    setup: dict[str, Any], search: str, expected: list[str]
) -> None:
    client = setup["owner"].client
    team_id = setup["team"]["id"]
    create_issue(client, team_id, "Reach 100% coverage")
    create_issue(client, team_id, "Rename snake_case field")
    create_issue(client, team_id, "Fix C:\\temp path")

    assert _identifiers(setup, search=search) == expected


def test_search_matches_the_visible_description_text_only(
    setup: dict[str, Any],
) -> None:
    client = setup["owner"].client
    team_id = setup["team"]["id"]
    create_issue(
        client, team_id, "Budget", description="<p><strong>R&amp;D</strong> plan</p>"
    )

    # Markup is not text: "strong" is a tag name, not a word in any issue.
    assert _identifiers(setup, search="strong") == []
    # Entities are decoded: "R&D" matches the stored "R&amp;D".
    assert _identifiers(setup, search="R&D") == ["ENG-6"]
    assert _identifiers(setup, search="trace") == ["ENG-1"]


def test_search_by_identifier_matches_the_team_key(setup: dict[str, Any]) -> None:
    client = setup["owner"].client
    design = create_team(client, setup["workspace"]["id"], name="Design", key="DES")
    create_issue(client, design["id"], "Moodboard")
    create_issue(client, design["id"], "Icons")

    assert _identifiers(setup, search="DES-2") == ["DES-2"]
    assert _identifiers(setup, search="des-2") == ["DES-2"]
    assert _identifiers(setup, search="ENG-2") == ["ENG-2"]
    assert _identifiers(setup, search="OPS-2") == []
    # A bare number matches that number in every team.
    assert _identifiers(setup, search="2") == ["ENG-2", "DES-2"]


def test_filters_by_ids(setup: dict[str, Any]) -> None:
    issues, states = setup["issues"], setup["states"]

    assert _identifiers(setup, team_id=setup["team"]["id"]) == [
        "ENG-1",
        "ENG-2",
        "ENG-3",
        "ENG-4",
    ]
    assert _identifiers(
        setup, state_id__in=f"{states['Todo']['id']},{states['Done']['id']}"
    ) == ["ENG-1", "ENG-4"]
    assert _identifiers(setup, assignee_id=setup["member"].id) == ["ENG-2"]
    assert _identifiers(setup, creator_id=setup["member"].id) == ["ENG-4"]
    assert _identifiers(setup, "member", creator_id="me") == ["ENG-4"]
    assert _identifiers(setup, label_id=setup["labels"]["Feature"]["id"]) == ["ENG-2"]
    assert _identifiers(setup, parent_id=issues["ENG-1"]["id"]) == ["ENG-3"]
    # The member is subscribed as assignee of ENG-2 and as creator of ENG-4.
    assert _identifiers(setup, "member", subscriber_id="me") == ["ENG-2", "ENG-4"]
    assert _identifiers(setup, subscriber_id=setup["member"].id) == ["ENG-2", "ENG-4"]


@pytest.mark.parametrize(
    ("order_by", "expected"),
    [
        ("priority", ["ENG-3", "ENG-1", "ENG-2", "ENG-4"]),
        ("-priority", ["ENG-4", "ENG-2", "ENG-1", "ENG-3"]),
        ("-created_at", ["ENG-4", "ENG-3", "ENG-2", "ENG-1"]),
        ("-sort_order", ["ENG-4", "ENG-3", "ENG-2", "ENG-1"]),
        ("title", ["ENG-3", "ENG-1", "ENG-4", "ENG-2"]),
    ],
)
def test_order_by(setup: dict[str, Any], order_by: str, expected: list[str]) -> None:
    assert _identifiers(setup, order_by=order_by) == expected


def test_pages(setup: dict[str, Any]) -> None:
    response = setup["owner"].client.get(
        "/issues",
        params={"workspace_id": setup["workspace"]["id"], "size": 3, "page": 2},
    )

    body = response.json()
    assert body["total"] == 4
    assert body["pages"] == 2
    assert [i["identifier"] for i in body["items"]] == ["ENG-4"]


def test_list_only_shows_issues_of_the_workspace(
    setup: dict[str, Any],
) -> None:
    other = create_workspace(setup["owner"].client, team_key="OPS")
    create_issue(
        setup["owner"].client, workspace_team(setup["owner"].client, other["id"])["id"]
    )

    assert len(_identifiers(setup)) == 4
    response = setup["owner"].client.get(
        "/issues", params={"workspace_id": other["id"]}
    )
    assert [i["identifier"] for i in response.json()["items"]] == ["OPS-1"]


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"workspace_id": "nope"},
        {"order_by": "nope"},
        {"assignee_id": "someone"},
        {"creator_id": "none"},
        {"subscriber_id": "x"},
        {"state_type__in": "doing"},
        {"priority__in": "high"},
        {"size": 101},
    ],
)
def test_invalid_list_params_are_422(
    setup: dict[str, Any], params: dict[str, Any]
) -> None:
    query = {"workspace_id": setup["workspace"]["id"], **params}
    if not params:
        query = {}

    response = setup["owner"].client.get("/issues", params=query)

    assert_error(response, 422, "validation_error")
