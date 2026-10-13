"""Documents: create, list (filters, search, order), get, update, delete.

Workspace membership is the access rule: a non-member gets the 404 of a
missing document. A project or team of another workspace is a 400
``invalid_reference``. Every update sets ``last_edited_by`` to the editor.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_document,
    create_project,
    create_workspace,
    invite_member,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from tests.e2e.helpers import RegisteredUser

SUMMARY_FIELDS = {
    "id",
    "workspace_id",
    "project_id",
    "team_id",
    "title",
    "icon",
    "creator_id",
    "creator",
    "last_edited_by_id",
    "last_edited_by",
    "project",
    "sort_order",
    "created_at",
    "updated_at",
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


def _project(client: Any, workspace_id: str, name: str = "Launch") -> str:
    return create_project(client, workspace_id, name)["id"]


def _list(client: Any, workspace_id: str, **params: Any) -> dict[str, Any]:
    response = client.get("/documents", params={"workspace_id": workspace_id, **params})
    assert response.status_code == 200, response.text
    return response.json()


def test_create_document_with_defaults(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    response = owner.client.post(
        "/documents",
        json={"workspace_id": ws["workspace"]["id"], "title": "Spec"},
    )

    assert response.status_code == 201, response.text
    doc = response.json()
    assert set(doc) == SUMMARY_FIELDS | {"content"}
    assert doc["title"] == "Spec"
    assert doc["content"] == ""
    assert doc["icon"] is None
    assert doc["project"] is None
    me = {"id": owner.id, "name": "Owner", "email": owner.email}
    assert doc["creator"] == me
    assert doc["last_edited_by"] == me
    assert owner.client.get(f"/documents/{doc['id']}").json() == doc


def test_create_with_every_field(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    project_id = _project(owner.client, ws["workspace"]["id"])

    doc = create_document(
        owner.client,
        ws["workspace"]["id"],
        "Roadmap",
        content="<p>See ENG-1</p>",
        icon="🚀",
        project_id=project_id,
        team_id=ws["team"]["id"],
    )

    assert doc["content"] == "<p>See ENG-1</p>"
    assert doc["icon"] == "🚀"
    assert doc["project"] == {"id": project_id, "name": "Launch"}
    assert doc["team_id"] == ws["team"]["id"]


def test_references_of_another_workspace_are_rejected(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    other = create_workspace(owner.client, team_key="OPS")
    foreign_project = _project(owner.client, other["id"])
    foreign_team = workspace_team(owner.client, other["id"])["id"]
    wid = ws["workspace"]["id"]

    for extra in ({"project_id": foreign_project}, {"team_id": foreign_team}):
        response = owner.client.post(
            "/documents", json={"workspace_id": wid, "title": "X", **extra}
        )
        assert_error(response, 400, "invalid_reference")

    doc = create_document(owner.client, wid)
    response = owner.client.patch(
        f"/documents/{doc['id']}", json={"project_id": foreign_project}
    )
    assert_error(response, 400, "invalid_reference")


def test_list_filters_search_and_order(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    wid = ws["workspace"]["id"]
    project_id = _project(owner.client, wid)
    first = create_document(owner.client, wid, "Alpha notes", content="<p>x</p>")
    second = create_document(
        owner.client, wid, "Beta", content="<p>hidden needle</p>", project_id=project_id
    )
    third = create_document(owner.client, wid, "Gamma", team_id=ws["team"]["id"])
    create_document(owner.client, create_workspace(owner.client)["id"], "Elsewhere")

    page = _list(owner.client, wid)
    assert page["total"] == 3
    # Default order: most recently updated first.
    assert [d["id"] for d in page["items"]] == [third["id"], second["id"], first["id"]]
    assert set(page["items"][0]) == SUMMARY_FIELDS

    owner.client.patch(f"/documents/{first['id']}", json={"title": "Alpha v2"})
    assert _list(owner.client, wid)["items"][0]["id"] == first["id"]

    by_project = _list(owner.client, wid, project_id=project_id)["items"]
    assert [d["id"] for d in by_project] == [second["id"]]
    assert by_project[0]["project"] == {"id": project_id, "name": "Launch"}
    by_team = _list(owner.client, wid, team_id=ws["team"]["id"])["items"]
    assert [d["id"] for d in by_team] == [third["id"]]

    assert [d["id"] for d in _list(owner.client, wid, search="NEEDLE")["items"]] == [
        second["id"]
    ]
    assert [d["id"] for d in _list(owner.client, wid, search="alpha")["items"]] == [
        first["id"]
    ]
    titles = [d["title"] for d in _list(owner.client, wid, order_by="title")["items"]]
    assert titles == ["Alpha v2", "Beta", "Gamma"]


def test_search_matches_visible_text_only(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    wid = ws["workspace"]["id"]
    rich = create_document(
        owner.client,
        wid,
        "Rich",
        content=(
            '<p><strong>Bold</strong> and <a href="https://x.dev">link</a></p>'
            '<ul data-type="taskList"><li data-checked="true">done</li></ul>'
            "<p>Tom &amp; Jerry &lt;3</p><p>wo<em>rd</em></p><p>last</p>"
        ),
    )
    create_document(owner.client, wid, "Plain", content="<p>plain text</p>")

    def ids(search: str) -> list[str]:
        return [d["id"] for d in _list(owner.client, wid, search=search)["items"]]

    # Markup (tag names, attributes) is not visible text.
    for markup in ("strong", "href", "data-checked", "x.dev", "<p>", "&amp;"):
        assert ids(markup) == [], markup
    # LIKE wildcards are literal characters.
    for wildcard in ("%", "_", "\\"):
        assert ids(wildcard) == [], wildcard
    # Visible text matches, with entities decoded and inline tags joined.
    for text in ("bold and link", "Tom & Jerry <3", "word", "done"):
        assert ids(text) == [rich["id"]], text
    # Block tags separate words.
    assert ids("donetom") == []
    assert ids("jerry <3 word last") == [rich["id"]]


def test_list_rejects_unknown_order_field(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    response = owner.client.get(
        "/documents",
        params={"workspace_id": ws["workspace"]["id"], "order_by": "metadata"},
    )
    assert_error(response, 422, "validation_error")


def test_update_sets_last_edited_by(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    wid = ws["workspace"]["id"]
    editor = register_user(display_name="Editor")
    invite_member(owner.client, wid, editor.email)
    project_id = _project(owner.client, wid)
    doc = create_document(owner.client, wid, "Plan")

    response = editor.client.patch(
        f"/documents/{doc['id']}",
        json={
            "title": "Plan v2",
            "content": "<h1>Goals</h1>",
            "icon": "📄",
            "project_id": project_id,
            "sort_order": 7.5,
        },
    )

    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["title"] == "Plan v2"
    assert updated["content"] == "<h1>Goals</h1>"
    assert updated["icon"] == "📄"
    assert updated["project"] == {"id": project_id, "name": "Launch"}
    assert updated["sort_order"] == 7.5
    assert updated["creator"]["id"] == owner.id
    assert updated["last_edited_by"] == {
        "id": editor.id,
        "name": "Editor",
        "email": editor.email,
    }
    assert updated["updated_at"] > doc["updated_at"]

    cleared = owner.client.patch(
        f"/documents/{doc['id']}", json={"project_id": None, "icon": None}
    ).json()
    assert cleared["project"] is None
    assert cleared["icon"] is None
    assert cleared["last_edited_by"]["id"] == owner.id


def test_update_validation(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    doc = create_document(owner.client, ws["workspace"]["id"])
    for body in (
        {"title": ""},
        {"title": "   "},
        {"title": "\n\t\n"},
        {"title": None},
        {"content": None},
    ):
        response = owner.client.patch(f"/documents/{doc['id']}", json=body)
        assert_error(response, 422, "validation_error")


def test_title_is_one_trimmed_line(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    wid = ws["workspace"]["id"]
    blank = owner.client.post("/documents", json={"workspace_id": wid, "title": "  "})
    assert_error(blank, 422, "validation_error")

    created = owner.client.post(
        "/documents", json={"workspace_id": wid, "title": "  Launch\nplan  "}
    )
    assert created.status_code == 201, created.text
    assert created.json()["title"] == "Launch plan"

    updated = owner.client.patch(
        f"/documents/{created.json()['id']}", json={"title": " Q3\r\n\r\nroadmap "}
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Q3 roadmap"


def test_delete_document(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    doc = create_document(owner.client, ws["workspace"]["id"])

    response = owner.client.delete(f"/documents/{doc['id']}")

    assert response.status_code == 204, response.text
    assert_error(owner.client.get(f"/documents/{doc['id']}"), 404, "not_found")
    assert_error(owner.client.delete(f"/documents/{doc['id']}"), 404, "not_found")


def test_non_member_gets_404(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    wid = ws["workspace"]["id"]
    doc = create_document(owner.client, wid)
    stranger = register_user()

    assert_error(stranger.client.get(f"/documents/{doc['id']}"), 404, "not_found")
    assert_error(
        stranger.client.patch(f"/documents/{doc['id']}", json={"title": "Hack"}),
        404,
        "not_found",
    )
    assert_error(stranger.client.delete(f"/documents/{doc['id']}"), 404, "not_found")
    assert_error(
        stranger.client.get("/documents", params={"workspace_id": wid}),
        404,
        "not_found",
    )
    assert_error(
        stranger.client.post("/documents", json={"workspace_id": wid, "title": "X"}),
        404,
        "not_found",
    )
    assert owner.client.get(f"/documents/{doc['id']}").json()["title"] == "Doc"
