"""Workspace settings: rename / URL key / delete, members (invite, role,
remove, leave) and labels (create, update, delete).

Admins manage the workspace and its members; any member manages labels.
Others get the 404 of a missing row, never 403.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from tests.e2e.helpers import (
    assert_error,
    create_issue,
    create_label,
    create_workspace,
    invite_member,
    unique_email,
    unique_url_key,
    workspace_labels,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    import httpx

    from tests.e2e.helpers import RegisteredUser


# --- Workspace ---------------------------------------------------------------


def test_admin_renames_the_workspace_and_changes_its_url_key(
    auth_client: httpx.Client,
) -> None:
    workspace = create_workspace(auth_client, name="Acme")
    new_key = unique_url_key("renamed")

    response = auth_client.patch(
        f"/workspaces/{workspace['id']}", json={"name": "Acme Inc", "url_key": new_key}
    )

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Acme Inc"
    assert response.json()["url_key"] == new_key
    assert auth_client.get(f"/workspaces/{new_key}").json()["id"] == workspace["id"]
    assert_error(
        auth_client.get(f"/workspaces/{workspace['url_key']}"), 404, "not_found"
    )


def test_update_workspace_keeps_unsent_fields(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client, name="Acme")

    response = auth_client.patch(f"/workspaces/{workspace['id']}", json={"name": "X"})

    assert response.json()["url_key"] == workspace["url_key"]


def test_update_workspace_with_a_taken_url_key_is_refused(
    auth_client: httpx.Client,
) -> None:
    first = create_workspace(auth_client)
    second = create_workspace(auth_client)

    response = auth_client.patch(
        f"/workspaces/{second['id']}", json={"url_key": first["url_key"]}
    )

    assert_error(response, 400, "duplicate_item")


def test_update_workspace_validates_the_url_key(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)

    for bad in ("A", "Has Space", "-dash", "x" * 49, "login", "register"):
        response = auth_client.patch(
            f"/workspaces/{workspace['id']}", json={"url_key": bad}
        )
        assert_error(response, 422, "validation_error")


def test_update_workspace_to_a_reserved_url_key_is_refused(
    auth_client: httpx.Client,
) -> None:
    workspace = create_workspace(auth_client)

    response = auth_client.patch(
        f"/workspaces/{workspace['id']}", json={"url_key": "onboarding"}
    )

    body = assert_error(response, 422, "validation_error")
    assert "This URL is reserved" in body["detail"][0]["msg"]
    assert auth_client.get(f"/workspaces/{workspace['url_key']}").status_code == 200
    assert auth_client.get("/workspaces/onboarding").status_code == 404


def test_a_member_cannot_change_or_delete_the_workspace(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, member = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)

    assert_error(
        member.client.patch(f"/workspaces/{workspace['id']}", json={"name": "X"}),
        404,
        "not_found",
    )
    assert_error(
        member.client.delete(f"/workspaces/{workspace['id']}"), 404, "not_found"
    )


def test_admin_deletes_the_workspace_with_its_teams_and_issues(
    auth_client: httpx.Client,
) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    issue = create_issue(auth_client, team["id"], "Doomed")

    response = auth_client.delete(f"/workspaces/{workspace['id']}")

    assert response.status_code == 204, response.text
    assert workspace["id"] not in [
        w["id"] for w in auth_client.get("/workspaces").json()
    ]
    assert_error(auth_client.get(f"/issues/{issue['id']}"), 404, "not_found")
    assert_error(auth_client.get(f"/teams/{team['id']}"), 404, "not_found")


# --- Members -----------------------------------------------------------------


def test_admin_invites_an_existing_user_by_email(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner = register_user()
    invited = register_user(display_name="Grace Hopper")
    workspace = create_workspace(owner.client)

    response = owner.client.post(
        f"/workspaces/{workspace['id']}/members",
        json={"email": invited.email.upper()},
    )

    assert response.status_code == 201, response.text
    member = response.json()
    assert member["role"] == "member"
    assert member["user"] == {
        "id": invited.id,
        "name": "Grace Hopper",
        "email": invited.email,
    }
    assert workspace["id"] in [
        w["id"] for w in invited.client.get("/workspaces").json()
    ]


def test_invite_as_admin(register_user: Callable[..., RegisteredUser]) -> None:
    owner, invited = register_user(), register_user()
    workspace = create_workspace(owner.client)

    member = invite_member(owner.client, workspace["id"], invited.email, role="admin")

    assert member["role"] == "admin"


def test_invite_unknown_email_is_user_not_found(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)

    response = auth_client.post(
        f"/workspaces/{workspace['id']}/members", json={"email": unique_email()}
    )

    assert_error(response, 404, "user_not_found")


def test_invite_a_member_again_is_a_duplicate(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, invited = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], invited.email)

    response = owner.client.post(
        f"/workspaces/{workspace['id']}/members", json={"email": invited.email}
    )

    assert_error(response, 400, "duplicate_item")


def test_invite_validates_the_email(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)

    response = auth_client.post(
        f"/workspaces/{workspace['id']}/members", json={"email": "not-an-email"}
    )

    assert_error(response, 422, "validation_error")


def test_a_member_cannot_invite(register_user: Callable[..., RegisteredUser]) -> None:
    owner, member, other = register_user(), register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)

    response = member.client.post(
        f"/workspaces/{workspace['id']}/members", json={"email": other.email}
    )

    assert_error(response, 404, "not_found")


def test_admin_changes_a_member_role(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, invited = register_user(), register_user()
    workspace = create_workspace(owner.client)
    member = invite_member(owner.client, workspace["id"], invited.email)

    response = owner.client.patch(
        f"/workspaces/{workspace['id']}/members/{member['id']}", json={"role": "admin"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["role"] == "admin"
    assert response.json()["user"]["id"] == invited.id


def test_the_last_admin_cannot_be_demoted_or_leave(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner = register_user()
    workspace = create_workspace(owner.client)
    [me] = owner.client.get(f"/workspaces/{workspace['id']}/members").json()

    assert_error(
        owner.client.patch(
            f"/workspaces/{workspace['id']}/members/{me['id']}",
            json={"role": "member"},
        ),
        400,
        "last_admin",
    )
    assert_error(
        owner.client.delete(f"/workspaces/{workspace['id']}/members/{me['id']}"),
        400,
        "last_admin",
    )


def test_an_admin_can_leave_when_another_admin_stays(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, other = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], other.email, role="admin")
    me = owner.client.get(f"/workspaces/{workspace['id']}/members").json()[0]

    response = owner.client.delete(f"/workspaces/{workspace['id']}/members/{me['id']}")

    assert response.status_code == 204, response.text
    assert owner.client.get("/workspaces").json() == []


def test_admin_removes_a_member_who_also_leaves_the_teams(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, invited = register_user(), register_user()
    workspace = create_workspace(owner.client)
    team = workspace_team(owner.client, workspace["id"])
    member = invite_member(owner.client, workspace["id"], invited.email)
    assert invited.client.post(f"/teams/{team['id']}/members").status_code == 201

    response = owner.client.delete(
        f"/workspaces/{workspace['id']}/members/{member['id']}"
    )

    assert response.status_code == 204, response.text
    assert invited.client.get("/workspaces").json() == []
    team_members = owner.client.get(f"/teams/{team['id']}/members").json()
    assert invited.id not in [m["user_id"] for m in team_members]


def test_a_member_leaves_but_cannot_remove_others(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, first, second = register_user(), register_user(), register_user()
    workspace = create_workspace(owner.client)
    first_member = invite_member(owner.client, workspace["id"], first.email)
    second_member = invite_member(owner.client, workspace["id"], second.email)

    assert_error(
        first.client.delete(
            f"/workspaces/{workspace['id']}/members/{second_member['id']}"
        ),
        404,
        "not_found",
    )
    response = first.client.delete(
        f"/workspaces/{workspace['id']}/members/{first_member['id']}"
    )
    assert response.status_code == 204, response.text
    assert first.client.get("/workspaces").json() == []


def test_unknown_member_is_404(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)

    response = auth_client.patch(
        f"/workspaces/{workspace['id']}/members/{uuid.uuid4()}",
        json={"role": "admin"},
    )

    assert_error(response, 404, "not_found")


# --- Labels ------------------------------------------------------------------


def test_a_member_creates_updates_and_deletes_a_label(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, member = register_user(), register_user()
    workspace = create_workspace(owner.client)
    invite_member(owner.client, workspace["id"], member.email)

    created = member.client.post(
        f"/workspaces/{workspace['id']}/labels",
        json={"name": "Design", "color": "#26b5ce"},
    )
    assert created.status_code == 201, created.text
    label = created.json()
    assert label["name"] == "Design"
    assert label["color"] == "#26b5ce"
    assert label["workspace_id"] == workspace["id"]

    updated = member.client.patch(
        f"/labels/{label['id']}", json={"name": "UX", "color": "#f2994a"}
    )
    assert updated.status_code == 200, updated.text
    assert (updated.json()["name"], updated.json()["color"]) == ("UX", "#f2994a")

    deleted = member.client.delete(f"/labels/{label['id']}")
    assert deleted.status_code == 204, deleted.text
    assert "UX" not in workspace_labels(owner.client, workspace["id"])


def test_label_names_are_unique_per_workspace_in_any_case(
    auth_client: httpx.Client,
) -> None:
    workspace = create_workspace(auth_client)
    other = create_workspace(auth_client)
    label = create_label(auth_client, workspace["id"], "Design")

    assert_error(
        auth_client.post(
            f"/workspaces/{workspace['id']}/labels",
            json={"name": "bug", "color": "#eb5757"},
        ),
        400,
        "duplicate_item",
    )
    assert_error(
        auth_client.patch(f"/labels/{label['id']}", json={"name": "BUG"}),
        400,
        "duplicate_item",
    )
    # Another workspace can use the same name.
    create_label(auth_client, other["id"], "Design")


def test_label_color_must_be_a_hex_color(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)

    response = auth_client.post(
        f"/workspaces/{workspace['id']}/labels", json={"name": "X", "color": "red"}
    )

    assert_error(response, 422, "validation_error")


def test_deleting_a_label_removes_it_from_issues(auth_client: httpx.Client) -> None:
    workspace = create_workspace(auth_client)
    team = workspace_team(auth_client, workspace["id"])
    label = create_label(auth_client, workspace["id"], "Temp")
    issue = create_issue(auth_client, team["id"], "Labelled", label_ids=[label["id"]])

    assert auth_client.delete(f"/labels/{label['id']}").status_code == 204

    assert auth_client.get(f"/issues/{issue['id']}").json()["labels"] == []


def test_a_stranger_cannot_touch_labels(
    register_user: Callable[..., RegisteredUser],
) -> None:
    owner, stranger = register_user(), register_user()
    workspace = create_workspace(owner.client)
    label = create_label(owner.client, workspace["id"], "Private")

    assert_error(
        stranger.client.post(
            f"/workspaces/{workspace['id']}/labels",
            json={"name": "X", "color": "#000000"},
        ),
        404,
        "not_found",
    )
    assert_error(
        stranger.client.patch(f"/labels/{label['id']}", json={"name": "X"}),
        404,
        "not_found",
    )
    assert_error(stranger.client.delete(f"/labels/{label['id']}"), 404, "not_found")
