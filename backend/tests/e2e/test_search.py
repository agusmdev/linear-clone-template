"""Search: GET /workspaces/{id}/search over issues, documents and projects.

Projects and documents are inserted with SQL: their endpoints belong to other
features (when they exist, seed through them instead).
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_issue,
    create_workspace,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database


def insert_project(
    db: Database, workspace_id: str, name: str, description: str | None = None
) -> str:
    project_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO project (id, workspace_id, name, description, status, color, "
        "icon, sort_order, created_at, updated_at) VALUES "
        "(%s, %s, %s, %s, 'started', '#5e6ad2', NULL, 0, now(), now())",
        (project_id, workspace_id, name, description),
    )
    return project_id


def insert_document(
    db: Database, workspace_id: str, title: str, content: str = ""
) -> str:
    document_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO document (id, workspace_id, title, content, icon, sort_order, "
        "created_at, updated_at) VALUES (%s, %s, %s, %s, NULL, 0, now(), now())",
        (document_id, workspace_id, title, content),
    )
    return document_id


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


def search(owner: RegisteredUser, workspace_id: str, **params: Any) -> dict[str, Any]:
    response = owner.client.get(f"/workspaces/{workspace_id}/search", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_search_finds_issues_documents_and_projects(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    workspace_id = ws["workspace"]["id"]
    team = ws["team"]
    issue = create_issue(owner.client, team["id"], "Rocket launch checklist")
    create_issue(owner.client, team["id"], "Unrelated")
    create_issue(
        owner.client, team["id"], "Other", description="<p>the rocket fuel</p>"
    )
    document_id = insert_document(db, workspace_id, "Rocket design doc")
    insert_document(db, workspace_id, "Notes", content="<p>about rockets</p>")
    project_id = insert_project(db, workspace_id, "Rocket program")

    body = search(owner, workspace_id, q="rocket")

    assert set(body) == {"issues", "documents", "projects"}
    assert {i["title"] for i in body["issues"]} == {"Rocket launch checklist", "Other"}
    found = next(i for i in body["issues"] if i["id"] == issue["id"])
    assert found == {
        "id": issue["id"],
        "identifier": issue["identifier"],
        "title": "Rocket launch checklist",
        "state": issue["state"],
        "team": issue["team"],
    }
    assert {d["title"] for d in body["documents"]} == {"Rocket design doc", "Notes"}
    doc = next(d for d in body["documents"] if d["id"] == document_id)
    assert doc == {
        "id": document_id,
        "title": "Rocket design doc",
        "icon": None,
        "project_id": None,
    }
    assert body["projects"] == [
        {
            "id": project_id,
            "name": "Rocket program",
            "icon": None,
            "color": "#5e6ad2",
            "status": "started",
        }
    ]


def test_search_by_identifier_ranks_exact_match_first(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    team = ws["team"]
    first = create_issue(owner.client, team["id"], "First")
    for n in range(3):
        create_issue(owner.client, team["id"], f"Mentions {first['identifier']} {n}")

    body = search(owner, ws["workspace"]["id"], q=first["identifier"].lower())

    assert body["issues"][0]["id"] == first["id"]
    assert len(body["issues"]) == 4

    by_number = search(owner, ws["workspace"]["id"], q=str(first["number"]))
    assert by_number["issues"][0]["id"] == first["id"]


def test_search_types_limit_and_empty_query(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    workspace_id = ws["workspace"]["id"]
    for n in range(4):
        create_issue(owner.client, ws["team"]["id"], f"Alpha {n}")
    insert_project(db, workspace_id, "Alpha project")

    only_projects = search(owner, workspace_id, q="alpha", types="project")
    assert only_projects["issues"] == []
    assert len(only_projects["projects"]) == 1

    limited = search(owner, workspace_id, q="alpha", limit=2)
    assert len(limited["issues"]) == 2

    assert search(owner, workspace_id, q="   ") == {
        "issues": [],
        "documents": [],
        "projects": [],
    }
    # LIKE wildcards are matched literally.
    assert search(owner, workspace_id, q="%")["issues"] == []


def test_search_skips_archived_issues(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    issue = create_issue(owner.client, ws["team"]["id"], "Archived thing")
    response = owner.client.patch(f"/issues/{issue['id']}", json={"archived": True})
    assert response.status_code == 200, response.text

    assert search(owner, ws["workspace"]["id"], q="archived thing")["issues"] == []


def test_search_is_scoped_to_members(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    create_issue(owner.client, ws["team"]["id"], "Secret")
    other = register_user()
    other_ws = create_workspace(other.client)

    response = other.client.get(
        f"/workspaces/{ws['workspace']['id']}/search", params={"q": "secret"}
    )
    assert_error(response, 404, "not_found")
    assert search(other, other_ws["id"], q="secret")["issues"] == []


def test_search_validation(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    url = f"/workspaces/{ws['workspace']['id']}/search"
    assert_error(owner.client.get(url, params={"limit": 0}), 422, "validation_error")
    assert_error(
        owner.client.get(url, params={"types": "user"}), 422, "validation_error"
    )
