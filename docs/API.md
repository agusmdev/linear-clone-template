# API contract — Linear clone

This file is the contract between the backend (`backend/`) and the frontend
(`frontend/`) for every feature in [FEATURES.md](../FEATURES.md).

- **IMPLEMENTED** = the endpoint exists, with e2e tests in `backend/tests/e2e/`.
  Only these are in `frontend/src/lib/api-endpoints.ts`.
- **PLANNED** = the shape is fixed here; the endpoint is not built yet. Build it
  exactly as written (or change this file in the same change).
- Frontend types for every response: `frontend/src/types/<entity>.ts`.

## Conventions

| Rule | Value |
|---|---|
| Base URL | `http://localhost:9095` (no `/api` prefix) |
| Auth | `Authorization: Bearer <session id>` on every route except `/auth/*` and `/health`. Missing header: 403 `http_error` |
| URLs | plural, kebab-case (`/workspaces`, `/workflow-states`, `/by-identifier/...`) |
| IDs | UUID strings |
| Timestamps | ISO 8601 with time zone (`2026-10-13T08:00:00.123456Z`) |
| Dates | `YYYY-MM-DD` (`due_date`, `start_date`, `starts_at` of cycles, ...) |
| Rich text | HTML strings from TipTap (`Issue.description`, `Comment.body`, `Document.content`) |
| Errors | JSON `{detail, error_code}` (see below) |
| Pages | `?page=1&size=50` (size 1..100) → `{items, total, page, size, pages}` (`Page<T>`) |
| Small collections | teams, states, labels, members, comments, relations, activity, favorites: a plain JSON array, no pages |
| PATCH | only the sent keys change; `null` clears a nullable field; `null` on a required field is 422 |
| Access | Everything belongs to a workspace. A user who is not a member of that workspace gets **404 `not_found`** (the same as a missing row), never 403 |

### Errors

| Case | Status | `error_code` |
|---|---|---|
| Validation (body, query, path) | 422 | `validation_error` (`detail` = list of `{loc, msg, type}`) |
| Not found / not a member | 404 | `not_found` |
| Unique conflict (URL key, team key, label name, ...) | 400 | `duplicate_item` |
| A referenced row is in another workspace/team, or does not exist (state, assignee, label, project, cycle, parent) | 400 | `invalid_reference` |
| Delete blocked by references | 400 | `referenced_item` |
| No session / bad session / expired | 403 `http_error` / 401 `invalid_session` / 401 `session_expired` |
| `POST /auth/login` fails (unknown email, wrong password or inactive user: one response, so it does not reveal which emails have an account) | 401 | `invalid_credentials` (`detail` = `Invalid email or password`) |

### Shared shapes

```ts
UserSummary   = { id, name, email }                 // name = User.display_name
TeamSummary   = { id, key, name }
StateSummary  = { id, name, type, color }           // type: backlog|unstarted|started|completed|canceled
LabelSummary  = { id, name, color }
IssueRef      = { id, identifier, title, state: StateSummary }
```

---

## 0. Auth and profile (existing template endpoints)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | POST | `/auth/register` | `{email, raw_password, display_name?}` | 201 `{id, expires_at, expires_in}` (a session: the user is signed in) |
| IMPLEMENTED | POST | `/auth/login` | `{email, password}` | 200 `{id, expires_at, expires_in, user}` |
| IMPLEMENTED | POST | `/auth/logout` | – | 200 |
| IMPLEMENTED | GET | `/users/me` | – | `User {id, email, display_name, email_verified_at, is_email_verified}` |
| IMPLEMENTED | PATCH | `/users/me` | `{display_name?, email?}` | `User` (WS-7) |

The user's display name is `display_name` on `/users/me` and `name` in every
embedded `UserSummary`. On register and `PATCH /users/me` the server trims it;
a sent name that is blank after the trim (`""`, `"   "`) is a 422
`validation_error`. An omitted name on register is stored as `""`.

---

## 1. Workspaces, members, teams, states, labels

### Who may change what (WS-3..WS-6)

| Action | Allowed for |
|---|---|
| Rename / change URL key / delete the workspace; invite members, change roles, remove members | workspace admins |
| Leave the workspace (DELETE your own member row) | any member (not the last admin) |
| Create a team, join or leave a team, read teams/members/states | any workspace member |
| Change a team (name, key, color, ...), add/remove its members, create/update/delete its workflow states | members of that team and workspace admins |
| Delete a team | workspace admins |
| Create / update / delete labels | any workspace member |

Anyone else gets the 404 `not_found` of a missing row (never 403).
Colors (`color` of teams, states, labels) are hex `#rrggbb`.

### Workspaces

`Workspace = {id, name, url_key, created_by_id, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | POST | `/workspaces` | `{name, url_key, team_name?, team_key?}` | 201 `Workspace` |
| IMPLEMENTED | GET | `/workspaces` | – | `Workspace[]` (mine, by name) |
| IMPLEMENTED | GET | `/workspaces/{url_key}` | – | `Workspace` (404 if not a member) |
| IMPLEMENTED | PATCH | `/workspaces/{workspace_id}` | `{name?, url_key?}` (admin) | `Workspace` |
| IMPLEMENTED | DELETE | `/workspaces/{workspace_id}` | – (admin) | 204 (deletes everything in it) |

POST `/workspaces` (WS-1), in one transaction:
- `url_key`: 2-48 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`, unique (else 400 `duplicate_item`).
- The creator becomes an `admin` member.
- A first team: `team_name` (default `"Engineering"`) and `team_key` (2-5
  uppercase letters; default = first 3 letters of the name: `ENG`). The creator
  joins it.
- The team's workflow states, in order: Backlog (backlog, `#bec2c8`), Todo
  (unstarted, `#e2e2e2`), In Progress (started, `#f2c94c`), In Review (started,
  `#0f783c`), Done (completed, `#5e6ad2`), Canceled (canceled, `#95a2b3`).
- Labels: Bug `#eb5757`, Feature `#bb87fc`, Improvement `#4ea7fc`.

### Members (WS-3)

`WorkspaceMember = {id, workspace_id, user_id, role: "admin"|"member", created_at, user: UserSummary}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/members` | – | `WorkspaceMember[]` (by join date) |
| IMPLEMENTED | POST | `/workspaces/{workspace_id}/members` | `{email, role?}` (admin) | 201 `WorkspaceMember`. Existing user only, added at once, no email. Unknown email: 404 `user_not_found`. Already a member: 400 `duplicate_item` |
| IMPLEMENTED | PATCH | `/workspaces/{workspace_id}/members/{member_id}` | `{role}` (admin) | `WorkspaceMember`. Demoting the last admin: 400 `last_admin` |
| IMPLEMENTED | DELETE | `/workspaces/{workspace_id}/members/{member_id}` | – (admin, or yourself = leave) | 204; the user also leaves every team of the workspace. The last admin cannot leave or be removed: 400 `last_admin` |

### Teams (WS-4)

`Team = {id, workspace_id, name, key, description, color, icon, created_at, updated_at}`
`TeamMember = {id, team_id, user_id, created_at, user: UserSummary}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/teams` | – | `Team[]` (by name) |
| IMPLEMENTED | POST | `/workspaces/{workspace_id}/teams` | `{name, key, description?, color?, icon?}` | 201 `Team`; creator joins; default states as above |
| IMPLEMENTED | GET | `/teams/{team_id}` | – | `Team` |
| IMPLEMENTED | PATCH | `/teams/{team_id}` | `{name?, key?, description?, color?, icon?}` | `Team` (a new key changes every identifier) |
| IMPLEMENTED | DELETE | `/teams/{team_id}` | – (admin) | 204 (deletes its issues). The last team of a workspace: 400 `last_team` |
| IMPLEMENTED | GET | `/teams/{team_id}/members` | – | `TeamMember[]` |
| IMPLEMENTED | POST | `/teams/{team_id}/members` | `{user_id?}` (default: me = join) | 201 `TeamMember`. Already in the team: 400 `duplicate_item`; `user_id` not a workspace member: 400 `invalid_reference` |
| IMPLEMENTED | DELETE | `/teams/{team_id}/members/{user_id}` | – (`me` allowed = leave) | 204 |

### Workflow states (WS-5)

`WorkflowState = {id, team_id, name, type, color, position, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/teams/{team_id}/states` | – | `WorkflowState[]` (by `position`) |
| IMPLEMENTED | POST | `/teams/{team_id}/states` | `{name, type, color, position?}` | 201 `WorkflowState` |
| IMPLEMENTED | PATCH | `/workflow-states/{state_id}` | `{name?, color?, position?, type?}` | `WorkflowState` |
| IMPLEMENTED | DELETE | `/workflow-states/{state_id}?move_to_state_id=` | – | 204. With issues and no `move_to_state_id`: 400 `referenced_item`. The target must be another state of the same team, else 400 `invalid_reference`; moved issues get the started/completed/canceled timestamps of the new state type. The last state of a team: 400 `last_state` |

### Labels (WS-6)

`Label = {id, workspace_id, name, color, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/labels` | – | `Label[]` (by name) |
| IMPLEMENTED | POST | `/workspaces/{workspace_id}/labels` | `{name, color}` | 201 `Label` (name unique per workspace, any case: else 400 `duplicate_item`) |
| IMPLEMENTED | PATCH | `/labels/{label_id}` | `{name?, color?}` | `Label` |
| IMPLEMENTED | DELETE | `/labels/{label_id}` | – | 204 (removed from issues) |

---

## 2. Issues

```ts
Issue = {
  id, workspace_id, team_id, number,
  identifier,                       // "ENG-12"
  title, description,               // description: HTML | null
  state_id, priority,               // 0 none, 1 urgent, 2 high, 3 medium, 4 low
  assignee_id, creator_id, project_id, cycle_id, parent_id,
  estimate, due_date, sort_order,
  started_at, completed_at, canceled_at, archived_at,
  created_at, updated_at,
  team: TeamSummary, state: StateSummary,
  assignee: UserSummary | null, creator: UserSummary | null,
  labels: LabelSummary[]            // by name
}
```

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | POST | `/issues` | `CreateIssue` | 201 `Issue` |
| IMPLEMENTED | GET | `/issues?workspace_id=...` | – | `Page<Issue>` |
| IMPLEMENTED | GET | `/issues/{issue_id}` | – | `Issue` (archived issues too) |
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/issues/by-identifier/{identifier}` | – | `Issue` (`ENG-12`, any case) |
| IMPLEMENTED | PATCH | `/issues/{issue_id}` | `UpdateIssue` | `Issue` |
| IMPLEMENTED | DELETE | `/issues/{issue_id}` | – | 204 (sub-issues lose their parent) |
| IMPLEMENTED | POST | `/issues/bulk-update` | `{issue_ids, update: {state_id?, priority?, assignee_id?, label_ids?, label_ids_add?, label_ids_remove?, project_id?, cycle_id?, archived?}}` | `{items: Issue[]}` (in `issue_ids` order); same rules and activity as PATCH, all or nothing |
| IMPLEMENTED | POST | `/issues/bulk-delete` | `{issue_ids}` | 204 |

**Bulk** (ISS-14): `issue_ids` 1-250 ids; one missing or hidden issue = 404 for the
whole request. `label_ids` replaces the labels; `label_ids_add` / `label_ids_remove`
add or remove labels and keep the others. `state_id`, `priority`, `label_ids`,
`archived` cannot be `null` (422). A state must belong to the team of every issue
(else 400 `invalid_reference`, nothing changes).

**Board drag** (ISS-4): no extra endpoint. `PATCH /issues/{id} {state_id, sort_order}`
with `sort_order` = the mean of the neighbours' values (top: first - 1, bottom: last + 1).

**CreateIssue** `{team_id, title, description?, state_id?, priority?, assignee_id?, label_ids?, project_id?, cycle_id?, parent_id?, estimate?, due_date?, sort_order?}`
- `title` 1-500 chars; `priority` 0-4 (default 0); `estimate` 0-1000; `label_ids` max 50.
- `state_id` default: the team's first `unstarted` state (Todo). Must be a state of the team.
- `number` = the team's next number (atomic per team); `identifier = "<team key>-<number>"`.
- `sort_order` default: after the team's last issue (max + 1).
- assignee must be a workspace member; labels, project, parent in the workspace; cycle in the team. Else 400 `invalid_reference`.
- The creator and the assignee are subscribed. Activity: one `created` row; with
  `parent_id`, also a `parent` row on the new issue and a `sub_issue` row on the parent.
- The state type sets `started_at` (started), `completed_at` (completed) or `canceled_at` (canceled).

**UpdateIssue** (PATCH; any subset) `{title, description, state_id, priority, assignee_id, label_ids, project_id, cycle_id, parent_id, estimate, due_date, sort_order, archived}`
- `label_ids` replaces the labels. `archived: true|false` sets/clears `archived_at`.
- State change: to started → `started_at` (kept if set), clear completed/canceled;
  completed → `completed_at = now`, clear `canceled_at`; canceled → `canceled_at = now`,
  clear `completed_at`; backlog/unstarted → clear all three.
- A parent cannot be the issue itself or one of its sub-issues (400 `invalid_reference`).
- One `IssueActivity` row per changed field (see Activity). `sort_order` changes are not logged. Unchanged values write nothing.
- A `parent_id` change also writes a `sub_issue` row on the old and on the new parent.
- A new assignee is subscribed.

**GET /issues query** (`workspace_id` required):

| Param | Meaning |
|---|---|
| `team_id` | one team |
| `state_id__in` | comma-separated state ids |
| `state_type__in` | e.g. `backlog`, `unstarted,started` (team tabs: Backlog / Active) |
| `priority__in` | e.g. `1,2` |
| `assignee_id` | user id, `me`, or `none` (unassigned) |
| `creator_id` | user id or `me` |
| `subscriber_id` | user id or `me` (My issues → Subscribed) |
| `label_id` | issues with this label |
| `assignee_id__in` | comma-separated: user ids, `me`, `none` (any of them) |
| `creator_id__in` | comma-separated: user ids, `me` |
| `label_id__in` | issues with any of these labels |
| `project_id__in`, `cycle_id__in` | comma-separated ids, `none` = no project / cycle |
| `project_id`, `cycle_id`, `parent_id` | equality |
| `parent_id__isnull` | `true` = top-level only, `false` = sub-issues only |
| `include_archived` | default `false` |
| `search` | title or description (ILIKE), or the number: `12` / `ENG-12` |
| `order_by` | comma-separated Issue columns, `-` = desc: `sort_order` (default, manual), `priority`, `created_at`, `updated_at`, `due_date`, `title`, `number` |
| `page`, `size` | pages |

Grouping (status, assignee, priority, project) is done by the client on the returned page; send `size=100` and fetch more pages as needed.

### Sub-issues (ISS-7)
`GET /issues?workspace_id=..&parent_id=<id>` lists sub-issues (pages, filters);
create one with `POST /issues {parent_id}`. Progress = sub-issues whose
`state.type` is `completed`. The issue page uses the shortcut below.

`SubIssues = {items: Issue[], total, completed}` (not archived, by `sort_order`; `completed` = state type `completed`)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/issues/{issue_id}/sub-issues` | – | `SubIssues` |

### Relations (ISS-8)

`IssueRelation = {id, type: "blocks"|"related"|"duplicate", direction: "outgoing"|"incoming", issue: IssueRef, created_at}`
(`outgoing`: this issue *type* `issue`, e.g. blocks; `incoming`: `issue` *type* this one, e.g. blocked by.)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/issues/{issue_id}/relations` | – | `IssueRelation[]` |
| IMPLEMENTED | POST | `/issues/{issue_id}/relations` | `{related_issue_id, type: "blocks"\|"blocked_by"\|"related"\|"duplicate"}` | 201 `IssueRelation` (`blocked_by` is stored as the other issue `blocks` this one) |
| IMPLEMENTED | DELETE | `/issue-relations/{relation_id}` | – | 204 |

Errors: the issue itself or an issue of another workspace → 400 `invalid_reference`;
the same type already between the two issues (either direction) → 400 `duplicate_item`.

### Comments (ISS-9)

`Comment = {id, issue_id, user_id, user: UserSummary | null, body, edited_at, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/issues/{issue_id}/comments` | – | `Comment[]` (oldest first) |
| IMPLEMENTED | POST | `/issues/{issue_id}/comments` | `{body}` | 201 `Comment`; activity `commented`; author subscribed; notifies subscribers (`commented`) |
| IMPLEMENTED | PATCH | `/comments/{comment_id}` | `{body}` (author only, else 404) | `Comment` (`edited_at = now`) |
| IMPLEMENTED | DELETE | `/comments/{comment_id}` | – (author only, else 404) | 204 |

### Activity (ISS-10)

`IssueActivity = {id, issue_id, actor_id, actor: UserSummary | null, action, field, from_value, to_value, created_at}`
- `action`: `created`, `updated`, `commented`, `archived`, `unarchived`.
- For `updated`, `field` is one of `title`, `description`, `state`, `priority`,
  `assignee`, `labels`, `project`, `cycle`, `parent`, `estimate`, `due_date`,
  `sub_issue`, `relation_blocks`, `relation_blocked_by`, `relation_related`,
  `relation_duplicate_of`, `relation_duplicated_by`.
  Values are display text: state name, assignee name (or email), label names
  joined with `", "`, project name, cycle name (or `Cycle <n>`), parent
  identifier, priority number as text. `description` rows have null values.
  `null` = empty.
- `sub_issue` and `relation_*` values are the other issue's identifier
  (`to_value` = added, `from_value` = removed). Adding or removing a relation
  writes one row on each of the two issues, as seen from that issue.

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/issues/{issue_id}/activity` | – | `IssueActivity[]` (oldest first). The client merges it with comments for the timeline |

(The rows are already written by the IMPLEMENTED create/update and relation endpoints.)

### Subscribers (ISS-11)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/issues/{issue_id}/subscribers` | – | `UserSummary[]` |
| IMPLEMENTED | POST | `/issues/{issue_id}/subscribers` | `{user_id?}` (default me) | 204 (idempotent) |
| IMPLEMENTED | DELETE | `/issues/{issue_id}/subscribers/{user_id}` | – (`me` allowed) | 204 |

(Creator and assignee are already subscribed automatically by the IMPLEMENTED endpoints.)

### Views (ISS-13)
No extra endpoints. My issues: `assignee_id=me` / `creator_id=me` /
`subscriber_id=me`. Team tabs: `team_id=..` plus nothing (All),
`state_type__in=unstarted,started` (Active), `state_type__in=backlog` (Backlog).

---

## 3. Documents

`DocumentSummary = {id, workspace_id, project_id, team_id, title, icon, creator_id, creator: UserSummary|null, last_edited_by_id, last_edited_by: UserSummary|null, project: {id, name}|null, sort_order, created_at, updated_at}`
`Document = DocumentSummary & {content}` (HTML)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/documents?workspace_id=..&project_id=&team_id=&search=&order_by=-updated_at` | – | `Page<DocumentSummary>` (search: title and content ILIKE) |
| IMPLEMENTED | POST | `/documents` | `{workspace_id, title, content?, icon?, project_id?, team_id?}` | 201 `Document` |
| IMPLEMENTED | GET | `/documents/{document_id}` | – | `Document` |
| IMPLEMENTED | PATCH | `/documents/{document_id}` | `{title?, content?, icon?, project_id?, team_id?, sort_order?}` | `Document` (`last_edited_by_id = me`) |
| IMPLEMENTED | DELETE | `/documents/{document_id}` | – | 204 |

DOC-7 (issue mentions): the client renders `ENG-12` text as a link to
`/<url_key>/issue/ENG-12` and resolves it with the IMPLEMENTED by-identifier endpoint.

---

## 4. Projects and cycles

### Projects (PRJ-1..3)

`Project = {id, workspace_id, name, description, status, lead_id, lead: UserSummary|null, start_date, target_date, color, icon, sort_order, team_ids: string[], teams: TeamSummary[], issue_count, completed_issue_count, progress: {total, completed, percentage}, created_at, updated_at}`
(`status`: planned|started|paused|completed|canceled; `description` is HTML. Counts ignore archived and canceled issues; completed = state type `completed`; `progress.total = issue_count`, `progress.completed = completed_issue_count`, `percentage` = 0-100 rounded down, 0 when there are no issues. `teams` by name.)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/projects?status=&team_id=` | – | `Project[]` (by `sort_order`; `team_id` = projects that have this team) |
| IMPLEMENTED | POST | `/projects` | `{workspace_id, name, description?, status?, lead_id?, start_date?, target_date?, color?, icon?, team_ids?}` | 201 `Project` (`sort_order` = after the last project; lead must be a member and teams in the workspace, else 400 `invalid_reference`) |
| IMPLEMENTED | GET | `/projects/{project_id}` | – | `Project` |
| IMPLEMENTED | PATCH | `/projects/{project_id}` | any field of POST except `workspace_id`, plus `sort_order` (`team_ids` replaces) | `Project` |
| IMPLEMENTED | DELETE | `/projects/{project_id}` | – | 204 (issues and documents keep existing, `project_id = null`) |

Project issues: `GET /issues?workspace_id=..&project_id=..`. Project documents: `GET /documents?workspace_id=..&project_id=..`.

### Cycles (CYC-1)

`Cycle = {id, team_id, number, name, starts_at, ends_at, status: "current"|"upcoming"|"past", issue_count, completed_issue_count, progress: CycleProgress, created_at, updated_at}`
`CycleProgress = {total, completed, percentage, scope: {backlog, unstarted, started, completed, canceled}}`

- `status` from today's date (UTC): `starts_at <= today <= ends_at` = current, `starts_at > today` = upcoming, else past.
- Dates are inclusive. `ends_at` must be after `starts_at` (else 400 `invalid_cycle_dates`); two cycles of one team never share a day (else 400 `cycle_overlap`).
- `scope` counts the non-archived issues of the cycle by state type. `total` = `issue_count` = scope without canceled; `completed` = `completed_issue_count`; `percentage` = round(completed * 100 / total), 0 when empty.

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/teams/{team_id}/cycles` | – | `Cycle[]` (by `starts_at`) |
| IMPLEMENTED | POST | `/teams/{team_id}/cycles` | `{name?, starts_at, ends_at}` | 201 `Cycle` (`number` = next per team) |
| IMPLEMENTED | GET | `/cycles/{cycle_id}` | – | `Cycle` |
| IMPLEMENTED | PATCH | `/cycles/{cycle_id}` | `{name?, starts_at?, ends_at?}` | `Cycle` |
| IMPLEMENTED | DELETE | `/cycles/{cycle_id}` | – | 204 (issues keep existing, `cycle_id = null`) |
| IMPLEMENTED | POST | `/cycles/{cycle_id}/complete` | `{target_cycle_id?}` (optional body) | `{moved, target_cycle: Cycle}`: moves the non-archived issues in backlog/unstarted/started states to `target_cycle_id` (default: the next cycle of the team; none: 400 `no_next_cycle`; not another cycle of the team: 400 `invalid_reference`). One `cycle` history row per moved issue |

Assign issues with `PATCH /issues/{id} {cycle_id}`; cycle issues with `GET /issues?cycle_id=..`.

---

## 5. Productivity

### Notifications / inbox (UX-3)

`Notification = {id, user_id, workspace_id, issue_id, actor_id, type, read_at, archived_at, created_at, issue: IssueRef|null, actor: UserSummary|null}`
(`type`: assigned | commented | status_changed | mentioned.)

Created by the issue features: `assigned` to the new assignee (not when you
assign yourself); `commented` and `status_changed` to every subscriber except
the actor.

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/notifications?workspace_id=..&unread=&include_archived=&type=&issue_id=` | – | `Page<Notification>` (newest first, mine only; archived left out unless `include_archived=true`; `unread=true` only unread, `false` only read) |
| IMPLEMENTED | GET | `/notifications/unread-count?workspace_id=..` | – | `{count}` (unread and not archived) |
| IMPLEMENTED | PATCH | `/notifications/{notification_id}` | `{read?, archived?}` | `Notification` (`true` sets `read_at`/`archived_at` to now, `false` clears it) |
| IMPLEMENTED | POST | `/notifications/mark-all-read` | `{workspace_id}` | `{updated}` |
| IMPLEMENTED | DELETE | `/notifications/{notification_id}` | – | 204 |

Another user's notification is a 404 (`not_found`), like a missing one. A
non-member of the workspace gets 404 on list, count and mark-all-read.
Creation: `NotificationService` (`backend/app/modules/notifications/service.py`)
is called by `IssueService` after a create/update (`assigned` also when an
issue is created with an assignee). Other features (comments, mentions) call
`NotificationService.notify_subscribers(...)` or insert rows themselves.

### Search (UX-1, UX-4)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/search?q=&types=issue,document,project&limit=10` | – | `{issues: (IssueRef & {team: TeamSummary})[], documents: {id, title, icon, project_id}[], projects: {id, name, icon, color, status}[]}` |

Issue search matches title, description and identifier (`ENG-12`, or the bare
number `12`); an exact identifier match comes first, then the newest updated;
archived issues are left out. Documents match title or content, projects name
or description. `limit` (1..50) is per type. An empty `q` returns empty lists.
`%` and `_` match literally.

### Favorites (UX-5)

`Favorite = {id, user_id, workspace_id, entity_type: "issue"|"project"|"document"|"team", entity_id, sort_order, name, identifier, icon, color, created_at}`
(`name` = display name: `ENG-12 Title`, project name, document title, team name.
`identifier` = issue identifier `ENG-12` or team key `ENG`, else null. `icon`/`color`
from the project, document or team, else null. Links: issue `/<url_key>/issue/<identifier>`,
project `/<url_key>/project/<entity_id>`, document `/<url_key>/document/<entity_id>`,
team `/<url_key>/team/<identifier>/issues`.)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/favorites` | – | `Favorite[]` (mine, by `sort_order`; rows whose entity is gone are left out) |
| IMPLEMENTED | POST | `/favorites` | `{workspace_id, entity_type, entity_id}` | 201 `Favorite`, appended last (again: 400 `duplicate_item`; entity not in the workspace: 400 `invalid_reference`) |
| IMPLEMENTED | PATCH | `/favorites/{favorite_id}` | `{sort_order}` | `Favorite` |
| IMPLEMENTED | DELETE | `/favorites/{favorite_id}` | – | 204 |

---

## Backend layout (for implementers)

| Module (`backend/app/modules/`) | Tables | API |
|---|---|---|
| `workspaces` | `workspace`, `workspace_member` | workspaces, members; `WorkspaceService.require_member()` / `require_admin()` / `are_members()` = the access check every module uses |
| `teams` | `team`, `team_member`, `workflow_state` | teams, states |
| `labels` | `label` | labels |
| `issues` | `issue`, `issue_label`, `issue_relation`, `issue_subscriber`, `comment`, `issue_activity` | issues, comments, relations, activity, subscribers, sub-issues (`detail_*.py` files) |
| `projects` | `project`, `project_team` | projects (CRUD, progress) |
| `cycles` | `cycle` | models only |
| `documents` | `document` | documents |
| `notifications` | `notification` | notifications (inbox); `NotificationService.notify_*` = creation, used by `IssueService` |
| `favorites` | `favorite` | favorites |
| `search` | – (reads `issue`, `document`, `project`) | search |

All tables exist (migration `add linear entities`). New endpoints need no
migration unless they change a model.
