"""Favorites: list (mine, resolved names), add, reorder, remove."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_document,
    create_issue,
    create_project,
    create_workspace,
    join_workspace,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database

FAVORITE_FIELDS = {
    "id",
    "user_id",
    "workspace_id",
    "entity_type",
    "entity_id",
    "sort_order",
    "name",
    "identifier",
    "icon",
    "color",
    "created_at",
}


@pytest.fixture
def owner(register_user: Callable[..., RegisteredUser]) -> RegisteredUser:
    return register_user(display_name="Owner")


@pytest.fixture
def ws(owner: RegisteredUser) -> dict[str, Any]:
    workspace = create_workspace(owner.client)
    return {
        "workspace": workspace,
        "team": workspace_team(owner.client, workspace["id"]),
    }


def add(
    user: RegisteredUser, workspace_id: str, entity_type: str, entity_id: str
) -> dict[str, Any]:
    response = user.client.post(
        "/favorites",
        json={
            "workspace_id": workspace_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def list_favorites(user: RegisteredUser, workspace_id: str) -> list[dict[str, Any]]:
    response = user.client.get(f"/workspaces/{workspace_id}/favorites")
    assert response.status_code == 200, response.text
    return response.json()


def test_add_and_list_every_entity_type(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    workspace_id = ws["workspace"]["id"]
    team = ws["team"]
    issue = create_issue(owner.client, team["id"], "Fix login")
    project_id = create_project(
        owner.client, workspace_id, "Launch", color="#26b5ce", icon="rocket"
    )["id"]
    document_id = create_document(owner.client, workspace_id, "Spec")["id"]

    fav_issue = add(owner, workspace_id, "issue", issue["id"])
    assert set(fav_issue) == FAVORITE_FIELDS
    assert fav_issue["name"] == f"{issue['identifier']} Fix login"
    assert fav_issue["identifier"] == issue["identifier"]
    assert fav_issue["user_id"] == owner.id
    add(owner, workspace_id, "project", project_id)
    add(owner, workspace_id, "document", document_id)
    add(owner, workspace_id, "team", team["id"])

    favorites = list_favorites(owner, workspace_id)
    assert [(f["entity_type"], f["name"]) for f in favorites] == [
        ("issue", f"{issue['identifier']} Fix login"),
        ("project", "Launch"),
        ("document", "Spec"),
        ("team", team["name"]),
    ]
    assert [f["sort_order"] for f in favorites] == [0, 1, 2, 3]
    project = favorites[1]
    assert (project["icon"], project["color"], project["identifier"]) == (
        "rocket",
        "#26b5ce",
        None,
    )
    assert favorites[3]["identifier"] == team["key"]


def test_reorder_and_remove(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    workspace_id = ws["workspace"]["id"]
    first = add(
        owner,
        workspace_id,
        "issue",
        create_issue(owner.client, ws["team"]["id"], "One")["id"],
    )
    second = add(owner, workspace_id, "team", ws["team"]["id"])

    response = owner.client.patch(f"/favorites/{second['id']}", json={"sort_order": -1})
    assert response.status_code == 200, response.text
    assert response.json()["sort_order"] == -1
    assert response.json()["name"] == ws["team"]["name"]
    assert [f["id"] for f in list_favorites(owner, workspace_id)] == [
        second["id"],
        first["id"],
    ]

    response = owner.client.delete(f"/favorites/{first['id']}")
    assert response.status_code == 204, response.text
    assert [f["id"] for f in list_favorites(owner, workspace_id)] == [second["id"]]
    assert_error(owner.client.delete(f"/favorites/{first['id']}"), 404, "not_found")


def test_deleted_entity_is_left_out(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    workspace_id = ws["workspace"]["id"]
    issue = create_issue(owner.client, ws["team"]["id"], "Gone soon")
    add(owner, workspace_id, "issue", issue["id"])
    assert owner.client.delete(f"/issues/{issue['id']}").status_code == 204

    assert list_favorites(owner, workspace_id) == []


def test_add_errors(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    workspace_id = ws["workspace"]["id"]
    add(owner, workspace_id, "team", ws["team"]["id"])

    def post(payload: dict[str, Any]) -> Any:
        return owner.client.post("/favorites", json=payload)

    assert_error(
        post(
            {
                "workspace_id": workspace_id,
                "entity_type": "team",
                "entity_id": ws["team"]["id"],
            }
        ),
        400,
        "duplicate_item",
    )
    assert_error(
        post(
            {
                "workspace_id": workspace_id,
                "entity_type": "project",
                "entity_id": str(uuid.uuid4()),
            }
        ),
        400,
        "invalid_reference",
    )
    # A team of another workspace is not a team of this workspace.
    other = register_user()
    other_team = workspace_team(other.client, create_workspace(other.client)["id"])
    assert_error(
        post(
            {
                "workspace_id": workspace_id,
                "entity_type": "team",
                "entity_id": other_team["id"],
            }
        ),
        400,
        "invalid_reference",
    )
    assert_error(
        post(
            {
                "workspace_id": workspace_id,
                "entity_type": "user",
                "entity_id": ws["team"]["id"],
            }
        ),
        422,
        "validation_error",
    )


def test_favorites_are_personal(
    owner: RegisteredUser,
    ws: dict[str, Any],
    db: Database,
    register_user: Callable[..., RegisteredUser],
) -> None:
    workspace_id = ws["workspace"]["id"]
    favorite = add(owner, workspace_id, "team", ws["team"]["id"])
    member = register_user()
    join_workspace(db, workspace_id, member.id)

    assert list_favorites(member, workspace_id) == []
    assert_error(
        member.client.patch(f"/favorites/{favorite['id']}", json={"sort_order": 5}),
        404,
        "not_found",
    )
    assert_error(member.client.delete(f"/favorites/{favorite['id']}"), 404, "not_found")
    # The member can favorite the same team for themselves.
    add(member, workspace_id, "team", ws["team"]["id"])

    outsider = register_user()
    assert_error(
        outsider.client.get(f"/workspaces/{workspace_id}/favorites"), 404, "not_found"
    )
    assert_error(
        outsider.client.post(
            "/favorites",
            json={
                "workspace_id": workspace_id,
                "entity_type": "team",
                "entity_id": ws["team"]["id"],
            },
        ),
        404,
        "not_found",
    )
