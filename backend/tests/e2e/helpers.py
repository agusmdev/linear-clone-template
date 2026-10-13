"""Small helpers for e2e tests: assertions and data set-up through the real API."""

from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Iterator

    import httpx

    from tests.e2e.stack import Database

from tests.e2e.stack import SERVER_DB_POOL_SIZE

DEFAULT_PASSWORD = "correct-horse-battery-staple"
EXPIRED = "2000-01-01 00:00:00+00"
# JSON allows "\u0000" in strings; Postgres text cannot store it.
NUL = "\u0000"


@dataclass
class RegisteredUser:
    """A user created through POST /auth/register, logged in through POST /auth/login."""

    id: str
    email: str
    password: str
    display_name: str
    session_id: str
    client: httpx.Client


def unique_email(prefix: str = "user") -> str:
    """Return an email address no other test uses."""
    return f"{prefix}-{uuid.uuid4().hex[:12]}@example.com"


def assert_error(
    response: httpx.Response,
    status: int,
    error_code: str,
    detail: Any = None,
) -> dict[str, Any]:
    """Assert the API error contract: the status and a JSON ``{detail, error_code}``."""
    assert response.status_code == status, (
        f"expected {status}, got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert set(body) == {"detail", "error_code"}, body
    assert body["error_code"] == error_code, body
    if detail is not None:
        assert body["detail"] == detail, body
    return body


def create_item(
    client: httpx.Client, name: str = "Item", description: str | None = None
) -> dict[str, Any]:
    """Create an item through POST /items and return the response body."""
    payload: dict[str, Any] = {"name": name}
    if description is not None:
        payload["description"] = description
    response = client.post("/items", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def unique_url_key(prefix: str = "ws") -> str:
    """Return a workspace URL key no other test uses."""
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def create_workspace(
    client: httpx.Client,
    name: str = "Acme",
    url_key: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    """Create a workspace through POST /workspaces and return the response body."""
    payload: dict[str, Any] = {
        "name": name,
        "url_key": url_key or unique_url_key(),
        **extra,
    }
    response = client.post("/workspaces", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def workspace_team(client: httpx.Client, workspace_id: str) -> dict[str, Any]:
    """Return the first team of the workspace (the default team after creation)."""
    response = client.get(f"/workspaces/{workspace_id}/teams")
    assert response.status_code == 200, response.text
    return response.json()[0]


def team_states(client: httpx.Client, team_id: str) -> dict[str, dict[str, Any]]:
    """Return the team's workflow states by name ("Todo", "Done", ...)."""
    response = client.get(f"/teams/{team_id}/states")
    assert response.status_code == 200, response.text
    return {state["name"]: state for state in response.json()}


def workspace_labels(
    client: httpx.Client, workspace_id: str
) -> dict[str, dict[str, Any]]:
    """Return the workspace's labels by name ("Bug", "Feature", ...)."""
    response = client.get(f"/workspaces/{workspace_id}/labels")
    assert response.status_code == 200, response.text
    return {label["name"]: label for label in response.json()}


def create_issue(
    client: httpx.Client, team_id: str, title: str = "Issue", **extra: Any
) -> dict[str, Any]:
    """Create an issue through POST /issues and return the response body."""
    response = client.post(
        "/issues", json={"team_id": team_id, "title": title, **extra}
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_project(
    client: httpx.Client, workspace_id: str, name: str = "Project", **extra: Any
) -> dict[str, Any]:
    """Create a project through POST /projects and return the response body."""
    response = client.post(
        "/projects", json={"workspace_id": workspace_id, "name": name, **extra}
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_document(
    client: httpx.Client, workspace_id: str, title: str = "Doc", **extra: Any
) -> dict[str, Any]:
    """Create a document through POST /documents and return the response body."""
    response = client.post(
        "/documents", json={"workspace_id": workspace_id, "title": title, **extra}
    )
    assert response.status_code == 201, response.text
    return response.json()


def join_workspace(db: Database, workspace_id: str, user_id: str) -> None:
    """Add a user to a workspace as a member.

    Invites (POST /workspaces/{id}/members) are not implemented yet; when they
    are, use the endpoint instead.
    """
    db.execute(
        "INSERT INTO workspace_member (id, workspace_id, user_id, role, created_at, "
        "updated_at) VALUES (gen_random_uuid(), %s, %s, 'member', now(), now())",
        (workspace_id, user_id),
    )


def login(api: httpx.Client, email: str, password: str) -> httpx.Response:
    """Call POST /auth/login and return the raw response."""
    return api.post("/auth/login", json={"email": email, "password": password})


# --- State the public API cannot create --------------------------------------
# Email delivery is not implemented, so the database is the "inbox": tests read
# emailed tokens from it. Expiry and deactivation have no endpoint either.


def password_reset_token(db: Database, user_id: str) -> str:
    """Return the user's newest unused password reset token (the emailed one)."""
    return db.fetch_one(
        "SELECT id FROM password_reset_token WHERE user_id = %s AND used_at IS NULL "
        "ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    )[0]


def email_verification_token(db: Database, user_id: str) -> str:
    """Return the user's newest unused email verification token (the emailed one)."""
    return db.fetch_one(
        "SELECT id FROM email_verification_token "
        "WHERE user_id = %s AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    )[0]


def deactivate_user(db: Database, user_id: str) -> None:
    """Set ``is_active = false`` (an admin action the API does not offer)."""
    assert db.execute('UPDATE "user" SET is_active = false WHERE id = %s', (user_id,))


def create_passwordless_user(db: Database, email: str) -> None:
    """Insert a user without a password, as Google sign-up creates one.

    The Google token exchange needs a third party, so the row is inserted
    directly.
    """
    db.execute(
        'INSERT INTO "user" '
        "(id, email, display_name, is_active, password, created_at, updated_at) "
        "VALUES (gen_random_uuid(), %s, 'OAuth User', true, NULL, now(), now())",
        (email,),
    )


@contextmanager
def drop_server_connections(db: Database, client: httpx.Client) -> Iterator[None]:
    """Cut the live server off from Postgres (an outage) for the ``with`` block.

    Use it as ``with drop_server_connections(db, client): response = client.get(...)``.
    Every request in the block that uses the database fails, like after a
    database restart or a network cut. (The server runs with the production
    default DB_POOL_PRE_PING=false, so it does not test connections first.)
    Send one successful request before this, so the server has connections.

    Postgres refuses new connections to the database until the block ends,
    so the server cannot replace a dropped connection with a working one.
    The open connection of ``db`` stays, so ``db`` works in the block.
    When the block ends, ``client`` sends requests until the server's pool
    holds no dropped connection, so later requests and tests are not hit.
    """
    _wait_until_server_connections_are_idle(db)
    db.allow_connections(False)
    try:
        rows = db.fetch_all(
            "SELECT pg_terminate_backend(pid, 5000) FROM pg_stat_activity "
            f"WHERE {_SERVER_BACKENDS}"
        )
        assert rows, "the server had no database connection to drop"
        assert all(terminated for (terminated,) in rows), rows
        yield
    finally:
        db.allow_connections(True)
        _wait_until_server_pool_recovers(client)


# The server's connections: every client backend on this database except db's.
_SERVER_BACKENDS = (
    "datname = current_database() AND pid <> pg_backend_pid() "
    "AND backend_type = 'client backend'"
)


def _wait_until_server_pool_recovers(client: httpx.Client) -> None:
    # A dropped connection stays in the pool until a request uses it and
    # fails. The pool hands out idle connections in order (FIFO), so
    # pool-size + 1 database requests in a row without a 500 prove that every
    # pooled connection works again. A login with an unknown email reads the
    # database and needs no account.
    successes = attempts = 0
    while successes <= SERVER_DB_POOL_SIZE:
        attempts += 1
        assert attempts <= 10 * SERVER_DB_POOL_SIZE, "the server did not recover"
        response = client.post(
            "/auth/login",
            json={"email": unique_email(), "password": DEFAULT_PASSWORD},
        )
        successes = successes + 1 if response.status_code != 500 else 0


def _wait_until_server_connections_are_idle(db: Database) -> None:
    # The server ends a request's transaction (COMMIT, then the connection goes
    # back to the pool) after it sent the response. A connection dropped in
    # that step is discarded, not put back in the pool. Wait for that step to
    # end, so the pool keeps the dropped connections and the next request
    # gets one of them (a failed SQL statement, not a failed connect).
    deadline = time.monotonic() + 10
    while db.fetch_all(
        f"SELECT pid FROM pg_stat_activity WHERE {_SERVER_BACKENDS} "
        "AND state IS DISTINCT FROM 'idle'"
    ):
        assert time.monotonic() < deadline, "the server's connections stay busy"
        time.sleep(0.01)


def list_notifications(
    client: httpx.Client, workspace_id: str, **params: Any
) -> list[dict[str, Any]]:
    """Return my notifications of a workspace (GET /notifications, newest first)."""
    response = client.get(
        "/notifications", params={"workspace_id": workspace_id, **params}
    )
    assert response.status_code == 200, response.text
    return response.json()["items"]


def create_cycle(
    client: httpx.Client, team_id: str, starts_at: str, ends_at: str, **extra: Any
) -> dict[str, Any]:
    """Create a cycle through POST /teams/{team_id}/cycles and return the body."""
    response = client.post(
        f"/teams/{team_id}/cycles",
        json={"starts_at": starts_at, "ends_at": ends_at, **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()
