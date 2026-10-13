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
embedded `UserSummary`.

---

## 1. Workspaces, members, teams, states, labels

### Workspaces

`Workspace = {id, name, url_key, created_by_id, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | POST | `/workspaces` | `{name, url_key, team_name?, team_key?}` | 201 `Workspace` |
| IMPLEMENTED | GET | `/workspaces` | – | `Workspace[]` (mine, by name) |
| IMPLEMENTED | GET | `/workspaces/{url_key}` | – | `Workspace` (404 if not a member) |
| PLANNED | PATCH | `/workspaces/{workspace_id}` | `{name?, url_key?}` (admin) | `Workspace` |
| PLANNED | DELETE | `/workspaces/{workspace_id}` | – (admin) | 204 |

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
| PLANNED | POST | `/workspaces/{workspace_id}/members` | `{email, role?}` (admin) | 201 `WorkspaceMember`. Existing user only, added at once, no email. Unknown email: 404 `user_not_found`. Already a member: 400 `duplicate_item` |
| PLANNED | PATCH | `/workspaces/{workspace_id}/members/{member_id}` | `{role}` (admin) | `WorkspaceMember` |
| PLANNED | DELETE | `/workspaces/{workspace_id}/members/{member_id}` | – (admin, or yourself = leave) | 204. The last admin cannot leave: 400 `last_admin` |

### Teams (WS-4)

`Team = {id, workspace_id, name, key, description, color, icon, created_at, updated_at}`
`TeamMember = {id, team_id, user_id, created_at, user: UserSummary}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/teams` | – | `Team[]` (by name) |
| PLANNED | POST | `/workspaces/{workspace_id}/teams` | `{name, key, description?, color?, icon?}` | 201 `Team`; creator joins; default states as above |
| PLANNED | GET | `/teams/{team_id}` | – | `Team` |
| PLANNED | PATCH | `/teams/{team_id}` | `{name?, key?, description?, color?, icon?}` | `Team` (a new key changes every identifier) |
| PLANNED | DELETE | `/teams/{team_id}` | – (admin) | 204 (deletes its issues) |
| PLANNED | GET | `/teams/{team_id}/members` | – | `TeamMember[]` |
| PLANNED | POST | `/teams/{team_id}/members` | `{user_id?}` (default: me = join) | 201 `TeamMember` |
| PLANNED | DELETE | `/teams/{team_id}/members/{user_id}` | – (`me` allowed = leave) | 204 |

### Workflow states (WS-5)

`WorkflowState = {id, team_id, name, type, color, position, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/teams/{team_id}/states` | – | `WorkflowState[]` (by `position`) |
| PLANNED | POST | `/teams/{team_id}/states` | `{name, type, color, position?}` | 201 `WorkflowState` |
| PLANNED | PATCH | `/workflow-states/{state_id}` | `{name?, color?, position?, type?}` | `WorkflowState` |
| PLANNED | DELETE | `/workflow-states/{state_id}?move_to_state_id=` | – | 204. With issues and no `move_to_state_id`: 400 `referenced_item`. The last state of a team: 400 |

### Labels (WS-6)

`Label = {id, workspace_id, name, color, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| IMPLEMENTED | GET | `/workspaces/{workspace_id}/labels` | – | `Label[]` (by name) |
| PLANNED | POST | `/workspaces/{workspace_id}/labels` | `{name, color}` | 201 `Label` (name unique per workspace) |
| PLANNED | PATCH | `/labels/{label_id}` | `{name?, color?}` | `Label` |
| PLANNED | DELETE | `/labels/{label_id}` | – | 204 (removed from issues) |

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
| PLANNED | POST | `/issues/bulk-update` | `{issue_ids, update: {state_id?, priority?, assignee_id?, label_ids?, project_id?, cycle_id?, archived?}}` | `{items: Issue[]}`; same rules and activity as PATCH, all or nothing |
| PLANNED | POST | `/issues/bulk-delete` | `{issue_ids}` | 204 |

**CreateIssue** `{team_id, title, description?, state_id?, priority?, assignee_id?, label_ids?, project_id?, cycle_id?, parent_id?, estimate?, due_date?, sort_order?}`
- `title` 1-500 chars; `priority` 0-4 (default 0); `estimate` 0-1000; `label_ids` max 50.
- `state_id` default: the team's first `unstarted` state (Todo). Must be a state of the team.
- `number` = the team's next number (atomic per team); `identifier = "<team key>-<number>"`.
- `sort_order` default: after the team's last issue (max + 1).
- assignee must be a workspace member; labels, project, parent in the workspace; cycle in the team. Else 400 `invalid_reference`.
- The creator and the assignee are subscribed. Activity: one `created` row.
- The state type sets `started_at` (started), `completed_at` (completed) or `canceled_at` (canceled).

**UpdateIssue** (PATCH; any subset) `{title, description, state_id, priority, assignee_id, label_ids, project_id, cycle_id, parent_id, estimate, due_date, sort_order, archived}`
- `label_ids` replaces the labels. `archived: true|false` sets/clears `archived_at`.
- State change: to started → `started_at` (kept if set), clear completed/canceled;
  completed → `completed_at = now`, clear `canceled_at`; canceled → `canceled_at = now`,
  clear `completed_at`; backlog/unstarted → clear all three.
- A parent cannot be the issue itself or one of its sub-issues (400 `invalid_reference`).
- One `IssueActivity` row per changed field (see Activity). `sort_order` changes are not logged. Unchanged values write nothing.
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
| `project_id`, `cycle_id`, `parent_id` | equality |
| `parent_id__isnull` | `true` = top-level only, `false` = sub-issues only |
| `include_archived` | default `false` |
| `search` | title or description (ILIKE), or the number: `12` / `ENG-12` |
| `order_by` | comma-separated Issue columns, `-` = desc: `sort_order` (default, manual), `priority`, `created_at`, `updated_at`, `due_date`, `title`, `number` |
| `page`, `size` | pages |

Grouping (status, assignee, priority, project) is done by the client on the returned page; send `size=100` and fetch more pages as needed.

### Sub-issues (ISS-7)
No extra endpoints: `GET /issues?workspace_id=..&parent_id=<id>` lists sub-issues;
create one with `POST /issues {parent_id}`. Progress = sub-issues whose
`state.type` is `completed`.

### Relations (ISS-8)

`IssueRelation = {id, type: "blocks"|"related"|"duplicate", direction: "outgoing"|"incoming", issue: IssueRef, created_at}`
(`outgoing`: this issue *type* `issue`, e.g. blocks; `incoming`: `issue` *type* this one, e.g. blocked by.)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/issues/{issue_id}/relations` | – | `IssueRelation[]` |
| PLANNED | POST | `/issues/{issue_id}/relations` | `{related_issue_id, type: "blocks"\|"blocked_by"\|"related"\|"duplicate"}` | 201 `IssueRelation` (`blocked_by` is stored as the other issue `blocks` this one) |
| PLANNED | DELETE | `/issue-relations/{relation_id}` | – | 204 |

### Comments (ISS-9)

`Comment = {id, issue_id, user_id, user: UserSummary | null, body, edited_at, created_at, updated_at}`

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/issues/{issue_id}/comments` | – | `Comment[]` (oldest first) |
| PLANNED | POST | `/issues/{issue_id}/comments` | `{body}` | 201 `Comment`; activity `commented`; author subscribed; notifies subscribers (`commented`) |
| PLANNED | PATCH | `/comments/{comment_id}` | `{body}` (author only, else 404) | `Comment` (`edited_at = now`) |
| PLANNED | DELETE | `/comments/{comment_id}` | – (author only, else 404) | 204 |

### Activity (ISS-10)

`IssueActivity = {id, issue_id, actor_id, actor: UserSummary | null, action, field, from_value, to_value, created_at}`
- `action`: `created`, `updated`, `commented`, `archived`, `unarchived`.
- For `updated`, `field` is one of `title`, `description`, `state`, `priority`,
  `assignee`, `labels`, `project`, `cycle`, `parent`, `estimate`, `due_date`.
  Values are display text: state name, assignee name (or email), label names
  joined with `", "`, project name, cycle name (or `Cycle <n>`), parent
  identifier, priority number as text. `description` rows have null values.
  `null` = empty.

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/issues/{issue_id}/activity` | – | `IssueActivity[]` (oldest first). The client merges it with comments for the timeline |

(The rows are already written by the IMPLEMENTED create/update endpoints.)

### Subscribers (ISS-11)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/issues/{issue_id}/subscribers` | – | `UserSummary[]` |
| PLANNED | POST | `/issues/{issue_id}/subscribers` | `{user_id?}` (default me) | 204 (idempotent) |
| PLANNED | DELETE | `/issues/{issue_id}/subscribers/{user_id}` | – (`me` allowed) | 204 |

(Creator and assignee are already subscribed automatically by the IMPLEMENTED endpoints.)

### Views (ISS-13)
No extra endpoints. My issues: `assignee_id=me` / `creator_id=me` /
`subscriber_id=me`. Team tabs: `team_id=..` plus nothing (All),
`state_type__in=unstarted,started` (Active), `state_type__in=backlog` (Backlog).

---

## 3. Documents

`DocumentSummary = {id, workspace_id, project_id, team_id, title, icon, creator_id, creator: UserSummary|null, last_edited_by_id, last_edited_by: UserSummary|null, sort_order, created_at, updated_at}`
`Document = DocumentSummary & {content}` (HTML)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/documents?workspace_id=..&project_id=&team_id=&search=&order_by=-updated_at` | – | `Page<DocumentSummary>` (search: title and content ILIKE) |
| PLANNED | POST | `/documents` | `{workspace_id, title, content?, icon?, project_id?, team_id?}` | 201 `Document` |
| PLANNED | GET | `/documents/{document_id}` | – | `Document` |
| PLANNED | PATCH | `/documents/{document_id}` | `{title?, content?, icon?, project_id?, team_id?, sort_order?}` | `Document` (`last_edited_by_id = me`) |
| PLANNED | DELETE | `/documents/{document_id}` | – | 204 |

DOC-7 (issue mentions): the client renders `ENG-12` text as a link to
`/<url_key>/issue/ENG-12` and resolves it with the IMPLEMENTED by-identifier endpoint.

---

## 4. Projects and cycles

### Projects (PRJ-1..3)

`Project = {id, workspace_id, name, description, status, lead_id, lead: UserSummary|null, start_date, target_date, color, icon, sort_order, team_ids: string[], issue_count, completed_issue_count, created_at, updated_at}`
(`status`: planned|started|paused|completed|canceled; counts ignore archived issues; progress = completed / count.)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/workspaces/{workspace_id}/projects?status=` | – | `Project[]` (by `sort_order`) |
| PLANNED | POST | `/projects` | `{workspace_id, name, description?, status?, lead_id?, start_date?, target_date?, color?, icon?, team_ids?}` | 201 `Project` |
| PLANNED | GET | `/projects/{project_id}` | – | `Project` |
| PLANNED | PATCH | `/projects/{project_id}` | any field of POST except `workspace_id`, plus `sort_order` (`team_ids` replaces) | `Project` |
| PLANNED | DELETE | `/projects/{project_id}` | – | 204 (issues and documents keep existing, `project_id = null`) |

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
| PLANNED | GET | `/notifications?workspace_id=..&unread=&include_archived=` | – | `Page<Notification>` (newest first, mine only) |
| PLANNED | GET | `/notifications/unread-count?workspace_id=..` | – | `{count}` |
| PLANNED | PATCH | `/notifications/{notification_id}` | `{read?, archived?}` | `Notification` |
| PLANNED | POST | `/notifications/mark-all-read` | `{workspace_id}` | `{updated}` |

### Search (UX-1, UX-4)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/workspaces/{workspace_id}/search?q=&types=issue,document,project&limit=10` | – | `{issues: IssueRef[], documents: {id, title, icon, project_id}[], projects: {id, name, icon, status}[]}` |

Issue search matches title, description and identifier (`ENG-12`).

### Favorites (UX-5)

`Favorite = {id, user_id, workspace_id, entity_type: "issue"|"project"|"document"|"team", entity_id, sort_order, name, created_at}`
(`name` = display name: `ENG-12 Title`, project name, document title, team name.)

| Status | Method | Path | Body | Response |
|---|---|---|---|---|
| PLANNED | GET | `/workspaces/{workspace_id}/favorites` | – | `Favorite[]` (mine, by `sort_order`; rows whose entity is gone are left out) |
| PLANNED | POST | `/favorites` | `{workspace_id, entity_type, entity_id}` | 201 `Favorite` (again: 400 `duplicate_item`) |
| PLANNED | PATCH | `/favorites/{favorite_id}` | `{sort_order}` | `Favorite` |
| PLANNED | DELETE | `/favorites/{favorite_id}` | – | 204 |

---

## Backend layout (for implementers)

| Module (`backend/app/modules/`) | Tables | API |
|---|---|---|
| `workspaces` | `workspace`, `workspace_member` | workspaces, members; `WorkspaceService.require_member()` / `require_admin()` / `are_members()` = the access check every module uses |
| `teams` | `team`, `team_member`, `workflow_state` | teams, states |
| `labels` | `label` | labels |
| `issues` | `issue`, `issue_label`, `issue_relation`, `issue_subscriber`, `comment`, `issue_activity` | issues (+ planned relations, comments, activity, subscribers) |
| `projects` | `project`, `project_team` | models only |
| `cycles` | `cycle` | models only |
| `documents` | `document` | models only |
| `notifications` | `notification` | models only |
| `favorites` | `favorite` | models only |

All tables exist (migration `add linear entities`). New endpoints need no
migration unless they change a model.
