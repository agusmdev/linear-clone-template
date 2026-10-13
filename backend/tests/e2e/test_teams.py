"""Teams (create, get, update, delete), team members (list, join, add, leave,
remove) and workflow states (create, update, reorder, delete).

Any workspace member creates teams and joins or leaves them. Team members and
workspace admins change a team and its states; only admins delete a team.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from tests.e2e.helpers import (
    assert_error,
    create_issue,
    create_team,
    create_workspace,
    invite_member,
    team_states,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    import httpx

    from tests.e2e.helpers import RegisteredUser

TEAM_FIELDS = {
    "id",
    "workspace_id",
    "name",
    "key",
    "description",
    "color",
    "icon",
    "created_at",
    "updated_at",
}


# --- Teams -------------------------------------------------------------------


def test_create_team_with_default_states_and_the_creator_as_member(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, member = register_user(), register_user(display_name="Ada")
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)

    response = member.client.post(
        f"/workspaces/{workspace['id']}/teams",
        json={
            "name": "Mobile",
            "key": "MOB",
            "description": "Apps",
            "color": "#4cb782",
        },
    )

    assert response.status_code == 201, response.text
    team = response.json()
    assert set(team) == TEAM_FIELDS
    assert (team["name"], team["key"], team["color"]) == ("Mobile", "MOB", "#4cb782")
    states = member.client.get(f"/teams/{team['id']}/states").json()
    assert [s["name"] for s in states] == [
        "Backlog",
        "Todo",
        "In Progress",
        "In Review",
        "Done",
        "Canceled",
    ]
    members = member.client.get(f"/teams/{team['id']}/members").json()
    assert [(m["user_id"], m["user"]["name"]) for m in members] == [(member.id, "Ada")]
    assert member.client.get(f"/teams/{team['id']}").json() == team


def test_team_keys_are_unique_and_validated(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)

    assert_error(
        auth_client.post(
            f"/workspaces/{workspace['id']}/teams", json={"name": "Eng", "key": "ENG"}
        ),
        400,
        "duplicate_item",
    )
    for bad in ("E", "eng", "TOOLONG", "E1"):
        assert_error(
            auth_client.post(
                f"/workspaces/{workspace['id']}/teams", json={"name": "X", "key": bad}
            ),
            422,
            "validation_error",
        )


def test_update_team_changes_the_issue_identifiers(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    issue = create_issue(auth_client, team["id"], "Renamed team")

    response = auth_client.patch(
        f"/teams/{team['id']}", json={"name": "Platform", "key": "PLT", "color": None}
    )

    assert response.status_code == 200, response.text
    assert (response.json()["name"], response.json()["key"]) == ("Platform", "PLT")
    assert auth_client.get(f"/issues/{issue['id']}").json()["identifier"] == "PLT-1"


def test_update_team_with_a_taken_key_is_refused(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    create_team(auth_client, workspace["id"], "Design", "DES")

    response = auth_client.patch(f"/teams/{team['id']}", json={"key": "DES"})

    assert_error(response, 400, "duplicate_item")


def test_only_team_members_and_admins_change_a_team(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, member = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)
    team = workspace_team(owner.client, workspace["id"])

    assert_error(
        member.client.patch(f"/teams/{team['id']}", json={"name": "X"}),
        404,
        "not_found",
    )
    assert member.client.post(f"/teams/{team['id']}/members").status_code == 201
    response = member.client.patch(f"/teams/{team['id']}", json={"name": "X"})
    assert response.status_code == 200, response.text


def test_admin_deletes_a_team_with_its_issues_but_not_the_last_one(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, member = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)
    first = workspace_team(owner.client, workspace["id"])
    second = create_team(member.client, workspace["id"], "Design", "DES")
    issue = create_issue(member.client, second["id"], "Design issue")

    # A member (even of the team) cannot delete it.
    assert_error(member.client.delete(f"/teams/{second['id']}"), 404, "not_found")

    response = owner.client.delete(f"/teams/{second['id']}")
    assert response.status_code == 204, response.text
    assert_error(owner.client.get(f"/teams/{second['id']}"), 404, "not_found")
    assert_error(owner.client.get(f"/issues/{issue['id']}"), 404, "not_found")

    assert_error(owner.client.delete(f"/teams/{first['id']}"), 400, "last_team")


def test_a_stranger_cannot_see_or_change_teams(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, stranger = register_user(), register_user()
    workspace = create_workspace(owner.client)
    team = workspace_team(owner.client, workspace["id"])

    assert_error(
        stranger.client.post(
            f"/workspaces/{workspace['id']}/teams", json={"name": "X", "key": "XX"}
        ),
        404,
        "not_found",
    )
    for method, path in (
        ("GET", f"/teams/{team['id']}"),
        ("GET", f"/teams/{team['id']}/members"),
        ("POST", f"/teams/{team['id']}/members"),
        ("DELETE", f"/teams/{team['id']}"),
    ):
        assert_error(stranger.client.request(method, path), 404, "not_found")


# --- Team members ------------------------------------------------------------


def test_join_and_leave_a_team(register_user: Callable[..., RegisteredUser]) -> None:
    owner, member = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)
    team = workspace_team(owner.client, workspace["id"])

    joined = member.client.post(f"/teams/{team['id']}/members")
    assert joined.status_code == 201, joined.text
    assert joined.json()["user_id"] == member.id
    assert_error(
        member.client.post(f"/teams/{team['id']}/members", json={}),
        400,
        "duplicate_item",
    )

    left = member.client.delete(f"/teams/{team['id']}/members/me")
    assert left.status_code == 204, left.text
    ids = [
        m["user_id"] for m in owner.client.get(f"/teams/{team['id']}/members").json()
    ]
    assert member.id not in ids


def test_team_manager_adds_and_removes_a_workspace_member(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, member, stranger = register_user(), register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)
    team = workspace_team(owner.client, workspace["id"])

    added = owner.client.post(
        f"/teams/{team['id']}/members", json={"user_id": member.id}
    )
    assert added.status_code == 201, added.text
    assert added.json()["user"]["id"] == member.id

    assert_error(
        owner.client.post(
            f"/teams/{team['id']}/members", json={"user_id": stranger.id}
        ),
        400,
        "invalid_reference",
    )

    removed = owner.client.delete(f"/teams/{team['id']}/members/{member.id}")
    assert removed.status_code == 204, removed.text
    assert_error(
        owner.client.delete(f"/teams/{team['id']}/members/{member.id}"),
        404,
        "not_found",
    )


def test_remove_member_path_must_be_a_uuid_or_me(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])

    response = auth_client.delete(f"/teams/{team['id']}/members/someone")

    assert_error(response, 422, "validation_error")


# --- Workflow states ---------------------------------------------------------


def test_add_a_state_at_the_end_or_at_a_position(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])

    response = auth_client.post(
        f"/teams/{team['id']}/states",
        json={"name": "QA", "type": "started", "color": "#26b5ce"},
    )
    assert response.status_code == 201, response.text
    state = response.json()
    assert (state["name"], state["type"], state["color"]) == (
        "QA",
        "started",
        "#26b5ce",
    )
    assert state["team_id"] == team["id"]
    assert state["position"] == 6

    first = auth_client.post(
        f"/teams/{team['id']}/states",
        json={"name": "Triage", "type": "backlog", "color": "#95a2b3", "position": -1},
    ).json()
    names = [s["name"] for s in auth_client.get(f"/teams/{team['id']}/states").json()]
    assert names[0] == "Triage"
    assert names[-1] == "QA"
    assert first["position"] == -1


def test_rename_recolor_retype_and_move_a_state(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    todo = team_states(auth_client, team["id"])["Todo"]

    response = auth_client.patch(
        f"/workflow-states/{todo['id']}",
        json={"name": "Ready", "color": "#4cb782", "type": "backlog", "position": 10},
    )

    assert response.status_code == 200, response.text
    state = response.json()
    assert (state["name"], state["color"], state["type"], state["position"]) == (
        "Ready",
        "#4cb782",
        "backlog",
        10,
    )
    names = [s["name"] for s in auth_client.get(f"/teams/{team['id']}/states").json()]
    assert names[-1] == "Ready"


def test_state_payloads_are_validated(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    todo = team_states(auth_client, team["id"])["Todo"]

    for body in (
        {"name": "", "type": "started", "color": "#ffffff"},
        {"name": "X", "type": "doing", "color": "#ffffff"},
        {"name": "X", "type": "started", "color": "white"},
    ):
        assert_error(
            auth_client.post(f"/teams/{team['id']}/states", json=body),
            422,
            "validation_error",
        )
    assert_error(
        auth_client.patch(f"/workflow-states/{todo['id']}", json={"name": None}),
        422,
        "validation_error",
    )


def test_team_and_state_names_are_trimmed_and_never_blank(
    auth_client: httpx.Client,
) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])

    created = auth_client.post(
        f"/workspaces/{workspace['id']}/teams", json={"name": "  Design ", "key": "DES"}
    )
    renamed = auth_client.patch(f"/teams/{team['id']}", json={"name": " Platform  "})
    state = auth_client.post(
        f"/teams/{team['id']}/states",
        json={"name": "  QA ", "type": "started", "color": "#ffffff"},
    )

    assert created.status_code == 201, created.text
    assert created.json()["name"] == "Design"
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Platform"
    assert state.status_code == 201, state.text
    assert state.json()["name"] == "QA"
    for blank in ("", "   "):
        assert_error(
            auth_client.post(
                f"/workspaces/{workspace['id']}/teams",
                json={"name": blank, "key": "BLK"},
            ),
            422,
            "validation_error",
        )
        assert_error(
            auth_client.patch(f"/teams/{team['id']}", json={"name": blank}),
            422,
            "validation_error",
        )
        assert_error(
            auth_client.post(
                f"/teams/{team['id']}/states",
                json={"name": blank, "type": "started", "color": "#ffffff"},
            ),
            422,
            "validation_error",
        )
        assert_error(
            auth_client.patch(
                f"/workflow-states/{state.json()['id']}", json={"name": blank}
            ),
            422,
            "validation_error",
        )


def test_state_names_are_unique_in_a_team(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    states = team_states(auth_client, team["id"])

    for name in ("Todo", "in progress", " Done "):
        assert_error(
            auth_client.post(
                f"/teams/{team['id']}/states",
                json={"name": name, "type": "started", "color": "#26b5ce"},
            ),
            400,
            "duplicate_item",
        )
    assert_error(
        auth_client.patch(
            f"/workflow-states/{states['Todo']['id']}", json={"name": "Backlog"}
        ),
        400,
        "duplicate_item",
    )
    assert len(team_states(auth_client, team["id"])) == len(states)

    # Same name, other case: a rename of the state itself is allowed.
    renamed = auth_client.patch(
        f"/workflow-states/{states['Todo']['id']}", json={"name": "TODO"}
    )
    assert renamed.status_code == 200, renamed.text
    # Another team can use the same name.
    other = create_team(auth_client, workspace["id"], "Design", "DES")
    response = auth_client.post(
        f"/teams/{other['id']}/states",
        json={"name": "QA", "type": "started", "color": "#26b5ce"},
    )
    assert response.status_code == 201, response.text
    response = auth_client.post(
        f"/teams/{team['id']}/states",
        json={"name": "QA", "type": "started", "color": "#26b5ce"},
    )
    assert response.status_code == 201, response.text


def test_delete_an_unused_state(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    review = team_states(auth_client, team["id"])["In Review"]

    response = auth_client.delete(f"/workflow-states/{review['id']}")

    assert response.status_code == 204, response.text
    assert "In Review" not in team_states(auth_client, team["id"])


def test_delete_a_used_state_needs_a_target_and_moves_the_issues(
    auth_client: httpx.Client,
) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    states = team_states(auth_client, team["id"])
    issue = create_issue(
        auth_client, team["id"], "Moved", state_id=states["Todo"]["id"]
    )

    assert_error(
        auth_client.delete(f"/workflow-states/{states['Todo']['id']}"),
        400,
        "referenced_item",
    )
    other_workspace = create_workspace(auth_client)
    foreign = team_states(
        auth_client, workspace_team(auth_client, other_workspace["id"])["id"]
    )["Done"]
    for bad_target in (foreign["id"], states["Todo"]["id"], str(uuid.uuid4())):
        assert_error(
            auth_client.delete(
                f"/workflow-states/{states['Todo']['id']}",
                params={"move_to_state_id": bad_target},
            ),
            400,
            "invalid_reference",
        )

    response = auth_client.delete(
        f"/workflow-states/{states['Todo']['id']}",
        params={"move_to_state_id": states["Done"]["id"]},
    )

    assert response.status_code == 204, response.text
    moved = auth_client.get(f"/issues/{issue['id']}").json()
    assert moved["state"]["name"] == "Done"
    assert moved["completed_at"] is not None


def test_the_last_state_of_a_team_cannot_be_deleted(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    states = list(team_states(auth_client, team["id"]).values())

    for state in states[:-1]:
        assert auth_client.delete(f"/workflow-states/{state['id']}").status_code == 204

    assert_error(
        auth_client.delete(f"/workflow-states/{states[-1]['id']}"), 400, "last_state"
    )


def test_only_team_managers_change_states(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, member = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)
    team = workspace_team(owner.client, workspace["id"])
    todo = team_states(owner.client, team["id"])["Todo"]

    assert_error(
        member.client.post(
            f"/teams/{team['id']}/states",
            json={"name": "X", "type": "started", "color": "#ffffff"},
        ),
        404,
        "not_found",
    )
    assert_error(
        member.client.patch(f"/workflow-states/{todo['id']}", json={"name": "X"}),
        404,
        "not_found",
    )
    assert_error(
        member.client.delete(f"/workflow-states/{todo['id']}"), 404, "not_found"
    )
    assert_error(
        member.client.patch(f"/workflow-states/{uuid.uuid4()}", json={"name": "X"}),
        404,
        "not_found",
    )
