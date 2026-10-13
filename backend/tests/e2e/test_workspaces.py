"""Workspaces: creation with defaults, my workspaces, lookup by URL key, members.

Also the read endpoints the workspace bootstrap feeds: teams, states, labels.
A user who is not a member gets the 404 of a missing workspace everywhere.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_workspace,
    join_workspace,
    team_states,
    unique_url_key,
    workspace_labels,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    import httpx

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database

WORKSPACE_FIELDS = {
    "id",
    "name",
    "url_key",
    "created_by_id",
    "created_at",
    "updated_at",
}


def test_create_workspace_returns_it_and_makes_the_creator_admin(
    register_user: Callable[..., RegisteredUser],
) -> None:
    user = register_user(display_name="Ada Lovelace")
    url_key = unique_url_key()

    response = user.client.post(
        "/workspaces", json={"name": "Acme", "url_key": url_key}
    )

    assert response.status_code == 201, response.text
    workspace = response.json()
    assert set(workspace) == WORKSPACE_FIELDS
    assert workspace["name"] == "Acme"
    assert workspace["url_key"] == url_key
    assert workspace["created_by_id"] == user.id

    members = user.client.get(f"/workspaces/{workspace['id']}/members")
    assert members.status_code == 200
    [member] = members.json()
    assert member["role"] == "admin"
    assert member["user_id"] == user.id
    assert member["workspace_id"] == workspace["id"]
    assert member["user"] == {
        "id": user.id,
        "name": "Ada Lovelace",
        "email": user.email,
    }


def test_create_workspace_makes_the_default_team_states_and_labels(
    auth_client: httpx.Client,
) -> None:
    workspace = create_workspace(auth_client)

    teams = auth_client.get(f"/workspaces/{workspace['id']}/teams").json()
    assert [(t["name"], t["key"]) for t in teams] == [("Engineering", "ENG")]
    assert teams[0]["workspace_id"] == workspace["id"]

    states = auth_client.get(f"/teams/{teams[0]['id']}/states").json()
    assert [(s["name"], s["type"]) for s in states] == [
        ("Backlog", "backlog"),
        ("Todo", "unstarted"),
        ("In Progress", "started"),
        ("In Review", "started"),
        ("Done", "completed"),
        ("Canceled", "canceled"),
    ]
    assert all(s["color"].startswith("#") for s in states)
    assert [s["position"] for s in states] == sorted(s["position"] for s in states)

    labels = auth_client.get(f"/workspaces/{workspace['id']}/labels").json()
    assert [(label["name"], label["color"]) for label in labels] == [
        ("Bug", "#eb5757"),
        ("Feature", "#bb87fc"),
        ("Improvement", "#4ea7fc"),
    ]


@pytest.mark.parametrize(
    ("extra", "expected"),
    [
        ({"team_name": "Design"}, ("Design", "DES")),
        ({"team_name": "Platform", "team_key": "PLT"}, ("Platform", "PLT")),
        ({"team_name": "Q"}, ("Q", "TEAM")),
    ],
)
def test_create_workspace_with_a_custom_first_team(
    auth_client: httpx.Client, extra: dict[str, Any], expected: tuple[str, str]
) -> None:
    workspace = create_workspace(auth_client, **extra)

    team = workspace_team(auth_client, workspace["id"])
    assert (team["name"], team["key"]) == expected


def test_create_workspace_with_a_taken_url_key_is_refused(
    register_user: Callable[..., RegisteredUser],
) -> None:
    first, second = register_user(), register_user()
    url_key = unique_url_key()
    create_workspace(first.client, url_key=url_key)

    response = second.client.post("/workspaces", json={"name": "B", "url_key": url_key})

    assert_error(response, 400, "duplicate_item")
    assert second.client.get("/workspaces").json() == []


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"url_key": "acme"}, "name"),
        ({"name": "", "url_key": "acme"}, "name"),
        ({"name": "A"}, "url_key"),
        ({"name": "A", "url_key": "Acme"}, "url_key"),
        ({"name": "A", "url_key": "acme corp"}, "url_key"),
        ({"name": "A", "url_key": "-acme"}, "url_key"),
        ({"name": "A", "url_key": "a"}, "url_key"),
        ({"name": "A", "url_key": "acme", "team_key": "eng"}, "team_key"),
        ({"name": "A", "url_key": "acme", "team_key": "E"}, "team_key"),
        ({"name": "A", "url_key": "acme", "team_key": "ENGINE"}, "team_key"),
    ],
)
def test_create_workspace_validates_the_payload(
    auth_client: httpx.Client, payload: dict[str, Any], field: str
) -> None:
    response = auth_client.post("/workspaces", json=payload)

    body = assert_error(response, 422, "validation_error")
    assert [issue["loc"] for issue in body["detail"]] == [["body", field]]


def test_list_workspaces_returns_only_mine(
    register_user: Callable[..., RegisteredUser],
) -> None:
    ada, bob = register_user(), register_user()
    zeta = create_workspace(ada.client, name="Zeta")
    alpha = create_workspace(ada.client, name="Alpha")
    create_workspace(bob.client, name="Bob's")

    response = ada.client.get("/workspaces")

    assert response.status_code == 200
    assert [w["id"] for w in response.json()] == [alpha["id"], zeta["id"]]


def test_get_workspace_by_url_key(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)

    response = auth_client.get(f"/workspaces/{workspace['url_key']}")

    assert response.status_code == 200
    assert response.json() == workspace


def test_get_unknown_workspace_is_404(auth_client: httpx.Client) -> None:
    assert_error(auth_client.get("/workspaces/no-such-key"), 404, "not_found")


def test_a_non_member_cannot_see_the_workspace(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, stranger = register_user(), register_user()
    workspace = create_workspace(owner.client)
    team = workspace_team(owner.client, workspace["id"])

    for path in (
        f"/workspaces/{workspace['url_key']}",
        f"/workspaces/{workspace['id']}/members",
        f"/workspaces/{workspace['id']}/teams",
        f"/workspaces/{workspace['id']}/labels",
        f"/teams/{team['id']}/states",
    ):
        assert_error(stranger.client.get(path), 404, "not_found")


def test_a_member_sees_the_workspace_and_all_members(
    register_user: Callable[..., RegisteredUser], db: Database
) -> None:
    owner = register_user(display_name="Owner")
    member = register_user(display_name="Member")
    workspace = create_workspace(owner.client)
    join_workspace(db, workspace["id"], member.id)

    assert [w["id"] for w in member.client.get("/workspaces").json()] == [
        workspace["id"]
    ]
    members = member.client.get(f"/workspaces/{workspace['id']}/members").json()
    assert [(m["user"]["name"], m["role"]) for m in members] == [
        ("Owner", "admin"),
        ("Member", "member"),
    ]
    assert set(
        team_states(member.client, workspace_team(member.client, workspace["id"])["id"])
    ) >= {"Todo"}
    assert set(workspace_labels(member.client, workspace["id"])) == {
        "Bug",
        "Feature",
        "Improvement",
    }


def test_unknown_team_states_is_404(auth_client: httpx.Client) -> None:
    response = auth_client.get(f"/teams/{uuid.uuid4()}/states")

    assert_error(response, 404, "not_found")


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/workspaces"),
        ("GET", "/workspaces"),
        ("GET", "/workspaces/acme"),
        ("GET", f"/workspaces/{uuid.UUID(int=1)}/members"),
        ("GET", f"/workspaces/{uuid.UUID(int=1)}/teams"),
        ("GET", f"/workspaces/{uuid.UUID(int=1)}/labels"),
        ("GET", f"/teams/{uuid.UUID(int=1)}/states"),
    ],
)
def test_workspace_routes_need_authentication(
    api: httpx.Client, method: str, path: str
) -> None:
    response = api.request(method, path, json={})

    assert_error(response, 403, "http_error", "Not authenticated")
