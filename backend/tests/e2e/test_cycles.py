"""Cycles: create (numbering, date checks), list with status and progress, get,
update, delete (issues stay), complete (unfinished issues move to the next cycle).

Workspace membership is the access rule: a non-member gets the 404 of a
missing cycle.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

import pytest

from tests.e2e.helpers import (
    assert_error,
    create_cycle,
    create_issue,
    create_workspace,
    team_states,
    workspace_team,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from tests.e2e.helpers import RegisteredUser
    from tests.e2e.stack import Database

CYCLE_FIELDS = {
    "id",
    "team_id",
    "number",
    "name",
    "starts_at",
    "ends_at",
    "status",
    "issue_count",
    "completed_issue_count",
    "progress",
    "created_at",
    "updated_at",
}


def _day(offset: int) -> str:
    """Today (UTC, like the server) plus ``offset`` days, as YYYY-MM-DD."""
    today = datetime.now(tz=UTC).date()
    return (today + timedelta(days=offset)).isoformat()


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


def test_create_cycle_numbers_per_team(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    team_id = ws["team"]["id"]
    response = owner.client.post(
        f"/teams/{team_id}/cycles",
        json={"starts_at": _day(-3), "ends_at": _day(10)},
    )

    assert response.status_code == 201, response.text
    cycle = response.json()
    assert set(cycle) == CYCLE_FIELDS
    assert cycle["number"] == 1
    assert cycle["name"] is None
    assert cycle["team_id"] == team_id
    assert cycle["status"] == "current"
    assert cycle["issue_count"] == 0
    assert cycle["progress"] == {
        "total": 0,
        "completed": 0,
        "percentage": 0,
        "scope": {
            "backlog": 0,
            "unstarted": 0,
            "started": 0,
            "completed": 0,
            "canceled": 0,
        },
    }

    second = create_cycle(owner.client, team_id, _day(11), _day(24), name="Polish")
    assert second["number"] == 2
    assert second["name"] == "Polish"
    assert second["status"] == "upcoming"

    # Another workspace's team starts again at 1.
    other_ws = create_workspace(owner.client)
    other_team = workspace_team(owner.client, other_ws["id"])
    assert create_cycle(owner.client, other_team["id"], _day(0), _day(5))["number"] == 1


def test_list_cycles_by_start_date_with_status(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    team_id = ws["team"]["id"]
    upcoming = create_cycle(owner.client, team_id, _day(20), _day(33))
    past = create_cycle(owner.client, team_id, _day(-30), _day(-17))
    current = create_cycle(owner.client, team_id, _day(-2), _day(11))

    response = owner.client.get(f"/teams/{team_id}/cycles")

    assert response.status_code == 200, response.text
    cycles = response.json()
    assert [c["id"] for c in cycles] == [past["id"], current["id"], upcoming["id"]]
    assert [c["status"] for c in cycles] == ["past", "current", "upcoming"]
    assert [c["number"] for c in cycles] == [2, 3, 1]


@pytest.mark.parametrize(
    ("starts", "ends"),
    [(5, 5), (5, 1)],
)
def test_create_cycle_rejects_bad_dates(
    owner: RegisteredUser, ws: dict[str, Any], starts: int, ends: int
) -> None:
    response = owner.client.post(
        f"/teams/{ws['team']['id']}/cycles",
        json={"starts_at": _day(starts), "ends_at": _day(ends)},
    )
    assert_error(response, 400, "invalid_cycle_dates")


@pytest.mark.parametrize(
    ("starts", "ends"),
    [(0, 3), (-5, 0), (13, 20), (-10, 30), (2, 4)],
)
def test_create_cycle_rejects_overlap(
    owner: RegisteredUser, ws: dict[str, Any], starts: int, ends: int
) -> None:
    team_id = ws["team"]["id"]
    create_cycle(owner.client, team_id, _day(0), _day(13))

    response = owner.client.post(
        f"/teams/{team_id}/cycles",
        json={"starts_at": _day(starts), "ends_at": _day(ends)},
    )
    assert_error(response, 400, "cycle_overlap")


def test_create_cycle_validation(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    team_id = ws["team"]["id"]
    assert_error(
        owner.client.post(f"/teams/{team_id}/cycles", json={"starts_at": _day(0)}),
        422,
        "validation_error",
    )
    assert_error(
        owner.client.post(
            f"/teams/{team_id}/cycles",
            json={"starts_at": "not-a-date", "ends_at": _day(3)},
        ),
        422,
        "validation_error",
    )
    assert_error(
        owner.client.post(
            f"/teams/{team_id}/cycles",
            json={"starts_at": _day(0), "ends_at": _day(3), "name": "x" * 256},
        ),
        422,
        "validation_error",
    )


def test_progress_counts_issues_by_state_type(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    team_id, states = ws["team"]["id"], ws["states"]
    cycle = create_cycle(owner.client, team_id, _day(-1), _day(12))
    for name in ("Backlog", "Todo", "In Progress", "Done", "Done", "Canceled"):
        create_issue(
            owner.client,
            team_id,
            f"In {name}",
            state_id=states[name]["id"],
            cycle_id=cycle["id"],
        )
    archived = create_issue(
        owner.client,
        team_id,
        "Archived",
        state_id=states["Done"]["id"],
        cycle_id=cycle["id"],
    )
    assert (
        owner.client.patch(
            f"/issues/{archived['id']}", json={"archived": True}
        ).status_code
        == 200
    )
    create_issue(owner.client, team_id, "No cycle")

    response = owner.client.get(f"/cycles/{cycle['id']}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["issue_count"] == 5
    assert body["completed_issue_count"] == 2
    assert body["progress"] == {
        "total": 5,
        "completed": 2,
        "percentage": 40,
        "scope": {
            "backlog": 1,
            "unstarted": 1,
            "started": 1,
            "completed": 2,
            "canceled": 1,
        },
    }
    listed = owner.client.get(f"/teams/{team_id}/cycles").json()
    assert listed[0]["progress"] == body["progress"]

    issues = owner.client.get(
        "/issues",
        params={"workspace_id": ws["workspace"]["id"], "cycle_id": cycle["id"]},
    ).json()
    assert issues["total"] == 6  # archived issues are hidden by default


def test_update_cycle(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    team_id = ws["team"]["id"]
    cycle = create_cycle(owner.client, team_id, _day(0), _day(13))
    create_cycle(owner.client, team_id, _day(14), _day(27))

    response = owner.client.patch(
        f"/cycles/{cycle['id']}", json={"name": "Launch", "ends_at": _day(10)}
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["name"] == "Launch"
    assert updated["ends_at"] == _day(10)
    assert updated["starts_at"] == _day(0)
    assert updated["number"] == 1

    # Clear the name; moving within its own range is no overlap with itself.
    response = owner.client.patch(
        f"/cycles/{cycle['id']}", json={"name": None, "starts_at": _day(1)}
    )
    assert response.status_code == 200, response.text
    assert response.json()["name"] is None
    assert response.json()["starts_at"] == _day(1)

    # An empty body changes nothing.
    assert owner.client.patch(f"/cycles/{cycle['id']}", json={}).status_code == 200

    assert_error(
        owner.client.patch(f"/cycles/{cycle['id']}", json={"ends_at": _day(20)}),
        400,
        "cycle_overlap",
    )
    assert_error(
        owner.client.patch(f"/cycles/{cycle['id']}", json={"ends_at": _day(0)}),
        400,
        "invalid_cycle_dates",
    )
    assert_error(
        owner.client.patch(f"/cycles/{cycle['id']}", json={"starts_at": None}),
        422,
        "validation_error",
    )


def test_delete_cycle_keeps_issues(owner: RegisteredUser, ws: dict[str, Any]) -> None:
    team_id = ws["team"]["id"]
    cycle = create_cycle(owner.client, team_id, _day(0), _day(13))
    issue = create_issue(owner.client, team_id, "Stays", cycle_id=cycle["id"])

    response = owner.client.delete(f"/cycles/{cycle['id']}")

    assert response.status_code == 204, response.text
    assert_error(owner.client.get(f"/cycles/{cycle['id']}"), 404, "not_found")
    kept = owner.client.get(f"/issues/{issue['id']}")
    assert kept.status_code == 200
    assert kept.json()["cycle_id"] is None


def test_complete_cycle_moves_unfinished_issues(
    owner: RegisteredUser, ws: dict[str, Any], db: Database
) -> None:
    team_id, states = ws["team"]["id"], ws["states"]
    cycle = create_cycle(owner.client, team_id, _day(-14), _day(-1))
    later = create_cycle(owner.client, team_id, _day(14), _day(27), name="Later")
    following = create_cycle(owner.client, team_id, _day(0), _day(13))
    todo = create_issue(owner.client, team_id, "Todo", cycle_id=cycle["id"])
    started = create_issue(
        owner.client,
        team_id,
        "Started",
        state_id=states["In Progress"]["id"],
        cycle_id=cycle["id"],
    )
    done = create_issue(
        owner.client,
        team_id,
        "Done",
        state_id=states["Done"]["id"],
        cycle_id=cycle["id"],
    )
    canceled = create_issue(
        owner.client,
        team_id,
        "Canceled",
        state_id=states["Canceled"]["id"],
        cycle_id=cycle["id"],
    )

    response = owner.client.post(f"/cycles/{cycle['id']}/complete")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["moved"] == 2
    assert body["target_cycle"]["id"] == following["id"]
    assert body["target_cycle"]["issue_count"] == 2

    def cycle_of(issue: dict[str, Any]) -> str | None:
        return owner.client.get(f"/issues/{issue['id']}").json()["cycle_id"]

    assert cycle_of(todo) == following["id"]
    assert cycle_of(started) == following["id"]
    assert cycle_of(done) == cycle["id"]
    assert cycle_of(canceled) == cycle["id"]
    history = db.fetch_all(
        "SELECT field, from_value, to_value FROM issue_activity "
        "WHERE issue_id = %s AND field = 'cycle'",
        (todo["id"],),
    )
    assert history == [("cycle", "Cycle 1", "Cycle 3")]

    # An explicit target.
    response = owner.client.post(
        f"/cycles/{following['id']}/complete",
        json={"target_cycle_id": later["id"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["moved"] == 2
    assert cycle_of(todo) == later["id"]

    # The last cycle has no next cycle; a target must be another cycle of the team.
    assert_error(
        owner.client.post(f"/cycles/{later['id']}/complete"), 400, "no_next_cycle"
    )
    assert_error(
        owner.client.post(
            f"/cycles/{later['id']}/complete", json={"target_cycle_id": later["id"]}
        ),
        400,
        "invalid_reference",
    )
    assert_error(
        owner.client.post(
            f"/cycles/{later['id']}/complete",
            json={"target_cycle_id": str(uuid.uuid4())},
        ),
        400,
        "invalid_reference",
    )


def test_issue_cycle_must_belong_to_team(
    owner: RegisteredUser, ws: dict[str, Any]
) -> None:
    other_ws = create_workspace(owner.client)
    other_team = workspace_team(owner.client, other_ws["id"])
    foreign = create_cycle(owner.client, other_team["id"], _day(0), _day(5))

    response = owner.client.post(
        "/issues",
        json={"team_id": ws["team"]["id"], "title": "x", "cycle_id": foreign["id"]},
    )
    assert_error(response, 400, "invalid_reference")


def test_non_member_gets_404(
    owner: RegisteredUser,
    ws: dict[str, Any],
    register_user: Callable[..., RegisteredUser],
) -> None:
    team_id = ws["team"]["id"]
    cycle = create_cycle(owner.client, team_id, _day(0), _day(13))
    stranger = register_user(display_name="Stranger").client

    assert_error(stranger.get(f"/teams/{team_id}/cycles"), 404, "not_found")
    assert_error(
        stranger.post(
            f"/teams/{team_id}/cycles",
            json={"starts_at": _day(20), "ends_at": _day(30)},
        ),
        404,
        "not_found",
    )
    assert_error(stranger.get(f"/cycles/{cycle['id']}"), 404, "not_found")
    assert_error(
        stranger.patch(f"/cycles/{cycle['id']}", json={"name": "x"}),
        404,
        "not_found",
    )
    assert_error(stranger.delete(f"/cycles/{cycle['id']}"), 404, "not_found")
    assert_error(stranger.post(f"/cycles/{cycle['id']}/complete"), 404, "not_found")
    assert_error(owner.client.get(f"/cycles/{uuid.uuid4()}"), 404, "not_found")
    assert_error(owner.client.get(f"/teams/{uuid.uuid4()}/cycles"), 404, "not_found")
