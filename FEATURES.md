# Linear Clone — Feature Specification

This document is the product contract. Every feature below must work end to end
(backend API + UI + e2e tests). Status column is updated as work lands.

Stack: FastAPI + SQLAlchemy + Postgres (backend), React 19 + TanStack Start/Router/Query +
Tailwind v4 + shadcn/ui (frontend). Visual style: Linear (dark-first, dense, keyboard-driven,
left sidebar, Inter font, subtle borders, small type 13px).

## 0. Auth (P0)

| ID | Feature | Status |
|---|---|---|
| AUTH-1 | Register with name, email, password (no email verification; user is signed in at once) | todo |
| AUTH-2 | Log in with email + password; log out | todo |
| AUTH-3 | Protected app routes redirect to /login; after login go to the workspace | done |

## 1. Workspaces, teams, members (P0)

| ID | Feature | Status |
|---|---|---|
| WS-1 | After first sign-in, onboarding asks for a workspace name + URL key; creates the workspace, a default team (e.g. "Engineering", key `ENG`) and default workflow states | done |
| WS-2 | A user can belong to many workspaces; workspace switcher in the sidebar | done |
| WS-3 | Invite members by email (existing users are added at once; no email sent) ; member list with roles (admin, member); remove member | done |
| WS-4 | Teams: create / rename / delete team, team key (2–5 uppercase letters), join/leave team, team members | done |
| WS-5 | Workflow states per team: Backlog, Todo, In Progress, In Review, Done, Canceled (types backlog/unstarted/started/completed/canceled); add/rename/recolor/reorder/delete states in team settings | done |
| WS-6 | Labels per workspace (name + color); create/edit/delete in settings | done |
| WS-7 | Profile settings: change display name; account page | done |

## 2. Issues — the ticketing system (P0)

| ID | Feature | Status |
|---|---|---|
| ISS-1 | Create issue (modal, `C` shortcut): title, description (rich text), team, status, priority (No priority/Urgent/High/Medium/Low), assignee, labels, project, cycle, estimate, due date, parent | todo |
| ISS-2 | Issue identifier `TEAMKEY-<number>` auto-increments per team; open issue by identifier URL `/<ws>/issue/ENG-12` | todo |
| ISS-3 | Issue list view grouped by status, with priority icon, identifier, title, labels, assignee avatar, dates; inline property changes | todo |
| ISS-4 | Board (kanban) view by status with drag and drop between columns and reorder inside a column | todo |
| ISS-5 | Filters: status, priority, assignee, label, project, cycle, creator; text search; sort (manual, priority, created, updated, due date); grouping (status, assignee, priority, project, none); display options persisted per view in URL | todo |
| ISS-6 | Issue detail page: editable title + rich-text description (autosave), properties sidebar (status, priority, assignee, labels, project, cycle, estimate, due date) | todo |
| ISS-7 | Sub-issues: create sub-issue, list with progress, parent breadcrumb | todo |
| ISS-8 | Relations: blocks / blocked by / related / duplicate of | todo |
| ISS-9 | Comments: add, edit, delete own comment; markdown/rich text | todo |
| ISS-10 | Activity history: every property change is logged and shown in the issue timeline merged with comments | todo |
| ISS-11 | Subscribe/unsubscribe; creator and assignee are subscribed automatically | todo |
| ISS-12 | Delete issue (with confirm); archive | todo |
| ISS-13 | Views: "My issues" (assigned / created / subscribed tabs), team "All issues" / "Active" / "Backlog" tabs | todo |
| ISS-14 | Bulk actions: multi-select rows (checkbox / shift-click), change status/priority/assignee, delete | todo |

## 3. Documents (P0)

| ID | Feature | Status |
|---|---|---|
| DOC-1 | Documents section in sidebar: list of workspace documents (title, author, updated at, project) with search | todo |
| DOC-2 | Create document (title + icon) optionally inside a project or team | todo |
| DOC-3 | Rich-text editor (TipTap): headings, bold/italic/strike/code, lists, checklists, quotes, code blocks, links, horizontal rule; markdown shortcuts; slash command menu | todo |
| DOC-4 | Autosave with "Saved" indicator; last edited by + time | todo |
| DOC-5 | Rename, delete document; move document to a project | todo |
| DOC-6 | Project page shows its documents | todo |
| DOC-7 | Mention issues in documents by identifier (ENG-12 renders as a link) | todo |

## 4. Projects & cycles (P1)

| ID | Feature | Status |
|---|---|---|
| PRJ-1 | Projects: create/edit/delete; name, description, status (planned/started/paused/completed/canceled), lead, teams, start + target date, icon/color | todo |
| PRJ-2 | Project list with progress (% of completed issues) | todo |
| PRJ-3 | Project detail: overview, issues (list/board), documents | todo |
| CYC-1 | Cycles per team: create with start/end dates; current/upcoming/past; assign issues; progress | todo |

## 5. Productivity (P1)

| ID | Feature | Status |
|---|---|---|
| UX-1 | Command palette (`Cmd/Ctrl+K`): navigate, create issue, search issues and documents | done |
| UX-2 | Keyboard shortcuts: `C` create issue, `/` search, `G then I` inbox, `G then M` my issues, `?` shortcuts help; in issue list `J/K` move, `Enter` open, `S` status, `P` priority, `A` assignee | todo |
| UX-3 | Inbox / notifications: assigned to you, comment on subscribed issue, status change on subscribed issue; mark read / read all; unread badge | todo |
| UX-4 | Global search page (issues + documents + projects) | done |
| UX-5 | Favorites in sidebar (issues, projects, documents) | done |
| UX-6 | Light / dark theme toggle (dark default) | done |

## Validation

- Backend: every endpoint has e2e tests (`backend/tests/e2e/`), route-coverage guard green.
- Frontend: every page has a Playwright spec (`frontend/e2e/`), route-coverage guard green.
- `make check` and `make test` pass on `main`.
- Manual QA in a real browser with the Docker stack (`docker compose up -d --build`).
