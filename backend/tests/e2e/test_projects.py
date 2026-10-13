"""Projects: create, list (status / team filters), get, update, delete, progress.

Workspace membership is the access rule: a non-member gets the 404 of a
missing project. Progress counts the project's issues: canceled and archived
issues are left out, completed = issues in a ``completed`` state.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_issue,
    create_project,
    create_team,
    create_workspace,
    invite_member,
    team_states,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from tests.e2e.helpers import RegisteredUser

PROJECT_FIELDS = {
    "id",
    "workspace_id",
    "name",
    "description",
    "status",
    "lead_id",
    "lead",
    "start_date",
    "target_date",
    "color",
    "icon",
    "sort_order",
    "team_ids",
    "teams",
    "issue_count",
    "completed_issue_count",
    "progress",
    "created_at",
    "updated_at",
}


@pytest.fixture
def owner(register_user: Callable[..., RegisteredUser]) -> RegisteredUser:
    return register_user(display_name="Owner")


@pytest.fixture
def ws(owner: RegisteredUser) -> dict[str, Any]:
    workspace = create_workspace(owner.client)
    team = workspace_team(owner.client, workspace["id"])
    return {
        "workspace": workspace,
        "team": team,
        "states": team_states(owner.client, team["id"]),
    }


def test_create_project_with_defaults(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    response = owner.client.post(
        "/projects", json={"workspace_id": ws["workspace"]["id"], "name": "Launch"}
    )

    assert response.status_code == 201, response.text
    project = response.json()
    assert set(project) == PROJECT_FIELDS
    assert project["name"] == "Launch"
    assert project["status"] == "planned"
    assert project["description"] is None
    assert project["lead"] is None
    assert project["team_ids"] == []
    assert project["teams"] == []
    assert project["issue_count"] == 0
    assert project["progress"] == {"total": 0, "completed": 0, "percentage": 0}
    assert owner.client.get(f"/projects/{project['id']}").json() == project


def test_create_project_with_every_field(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    project = create_project(
        owner.client,
        ws["workspace"]["id"],
        "Mobile app",
        description="<p>Ship it</p>",
        status="started",
        lead_id=owner.id,
        start_date="2026-10-01",
        target_date="2026-12-31",
        color="#5e6ad2",
        icon="rocket",
        team_ids=[ws["team"]["id"]],
    )

    assert project["description"] == "<p>Ship it</p>"
    assert project["status"] == "started"
    assert project["lead"] == {"id": owner.id, "name": "Owner", "email": owner.email}
    assert project["start_date"] == "2026-10-01"
    assert project["target_date"] == "2026-12-31"
    assert project["color"] == "#5e6ad2"
    assert project["icon"] == "rocket"
    assert project["team_ids"] == [ws["team"]["id"]]
    assert project["teams"] == [
        {"id": ws["team"]["id"], "key": "ENG", "name": "Engineering"}
    ]


def test_list_projects_by_sort_order_with_filters(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    workspace_id = ws["workspace"]["id"]
    design_team = create_team(owner.client, workspace_id, "Design", "DES")["id"]
    first = create_project(owner.client, workspace_id, "First")
    second = create_project(
        owner.client,
        workspace_id,
        "Second",
        status="completed",
        team_ids=[design_team, ws["team"]["id"]],
    )
    create_project(owner.client, create_workspace(owner.client)["id"], "Elsewhere")

    response = owner.client.get(f"/workspaces/{workspace_id}/projects")
    assert response.status_code == 200, response.text
    assert [p["id"] for p in response.json()] == [first["id"], second["id"]]
    assert [t["name"] for t in response.json()[1]["teams"]] == [
        "Design",
        "Engineering",
    ]

    by_status = owner.client.get(
        f"/workspaces/{workspace_id}/projects", params={"status": "completed"}
    ).json()
    assert [p["name"] for p in by_status] == ["Second"]

    by_team = owner.client.get(
        f"/workspaces/{workspace_id}/projects", params={"team_id": design_team}
    ).json()
    assert [p["name"] for p in by_team] == ["Second"]

    bad = owner.client.get(
        f"/workspaces/{workspace_id}/projects", params={"status": "nope"}
    )
    assert_error(bad, 422, "validation_error")


def test_progress_counts_completed_and_skips_canceled_and_archived(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    project = create_project(owner.client, ws["workspace"]["id"], "Progress")
    team_id, states = ws["team"]["id"], ws["states"]
    for state in ("Todo", "In Progress", "Done", "Canceled"):
        create_issue(
            owner.client,
            team_id,
            state,
            project_id=project["id"],
            state_id=states[state]["id"],
        )
    archived = create_issue(
        owner.client,
        team_id,
        "Archived",
        project_id=project["id"],
        state_id=states["Done"]["id"],
    )
    owner.client.patch(f"/issues/{archived['id']}", json={"archived": True})
    create_issue(owner.client, team_id, "No project")

    result = owner.client.get(f"/projects/{project['id']}").json()

    assert result["issue_count"] == 3
    assert result["completed_issue_count"] == 1
    assert result["progress"] == {"total": 3, "completed": 1, "percentage": 33}


def test_update_project(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    project = create_project(
        owner.client,
        ws["workspace"]["id"],
        "Old",
        lead_id=owner.id,
        team_ids=[ws["team"]["id"]],
        target_date="2026-11-01",
    )

    response = owner.client.patch(
        f"/projects/{project['id']}",
        json={
            "name": "New",
            "status": "paused",
            "description": "<p>Notes</p>",
            "lead_id": None,
            "team_ids": [],
            "target_date": None,
            "sort_order": 10,
        },
    )

    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["name"] == "New"
    assert updated["status"] == "paused"
    assert updated["description"] == "<p>Notes</p>"
    assert updated["lead"] is None
    assert updated["teams"] == []
    assert updated["target_date"] is None
    assert updated["sort_order"] == 10

    only_icon = owner.client.patch(f"/projects/{project['id']}", json={"icon": "bolt"})
    assert only_icon.json()["name"] == "New"
    assert only_icon.json()["icon"] == "bolt"

    assert_error(
        owner.client.patch(f"/projects/{project['id']}", json={"name": None}),
        422,
        "validation_error",
    )


def test_invalid_references(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    workspace_id = ws["workspace"]["id"]
    stranger = register_user()
    other_team = workspace_team(owner.client, create_workspace(owner.client)["id"])

    assert_error(
        owner.client.post(
            "/projects",
            json={"workspace_id": workspace_id, "name": "X", "lead_id": stranger.id},
        ),
        400,
        "invalid_reference",
    )
    assert_error(
        owner.client.post(
            "/projects",
            json={
                "workspace_id": workspace_id,
                "name": "X",
                "team_ids": [other_team["id"]],
            },
        ),
        400,
        "invalid_reference",
    )
    project = create_project(owner.client, workspace_id)
    assert_error(
        owner.client.patch(
            f"/projects/{project['id']}", json={"team_ids": [str(uuid.uuid4())]}
        ),
        400,
        "invalid_reference",
    )
    assert_error(
        owner.client.post("/projects", json={"workspace_id": workspace_id, "name": ""}),
        422,
        "validation_error",
    )


def test_delete_project_keeps_its_issues(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    project = create_project(owner.client, ws["workspace"]["id"], "Doomed")
    issue = create_issue(
        owner.client, ws["team"]["id"], "Survivor", project_id=project["id"]
    )

    response = owner.client.delete(f"/projects/{project['id']}")

    assert response.status_code == 204, response.text
    assert_error(owner.client.get(f"/projects/{project['id']}"), 404, "not_found")
    assert owner.client.get(f"/issues/{issue['id']}").json()["project_id"] is None


def test_non_member_gets_404(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    workspace_id = ws["workspace"]["id"]
    project = create_project(owner.client, workspace_id)
    stranger = register_user()
    path = f"/projects/{project['id']}"

    assert_error(stranger.client.get(path), 404, "not_found")
    assert_error(stranger.client.patch(path, json={"name": "Hi"}), 404, "not_found")
    assert_error(stranger.client.delete(path), 404, "not_found")
    assert_error(
        stranger.client.get(f"/workspaces/{workspace_id}/projects"), 404, "not_found"
    )
    assert_error(
        stranger.client.post(
            "/projects", json={"workspace_id": workspace_id, "name": "X"}
        ),
        404,
        "not_found",
    )
    assert_error(owner.client.get(f"/projects/{uuid.uuid4()}"), 404, "not_found")

    invite_member(owner.client, workspace_id, stranger.email)
    assert stranger.client.get(path).status_code == 200
    lead = owner.client.patch(path, json={"lead_id": stranger.id})
    assert lead.json()["lead"]["id"] == stranger.id
