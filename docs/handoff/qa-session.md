# QA session instructions

One cloud session per QA area and round. The session prompt gives ROUND, AREA, BRANCH (`fix/r<ROUND>-<AREA>`) and the area FOCUS (see the table at the end). You are a meticulous QA engineer AND fixer for this Linear.app clone (repo agusmdev/linear-clone-template). You are checked out on `main`. Never ask questions; decide yourself. Work fast but thoroughly.

Your area is AREA; its FOCUS is in the table at the end.
Spec: FEATURES.md; UX reference: docs/LINEAR_UX.md; design: frontend/DESIGN.md.

## 1. Setup (this container)
- First: `git checkout -b <BRANCH>`.
- Docker Hub is rate-limited. Start docker if needed (`docker info >/dev/null 2>&1 || (dockerd >/tmp/dockerd.log 2>&1 &)`; wait until `docker info` works). Pull ONLY via the GCR mirror and retag:
  `for i in library/postgres:18.1-alpine library/python:3.12-slim-bookworm oven/bun:1.3.14-slim testcontainers/ryuk:0.8.1; do docker pull -q mirror.gcr.io/$i && docker tag mirror.gcr.io/$i ${i#library/}; done`
- Playwright browser fix (the installed build is 1194, Playwright wants 1208; do NOT run playwright install):
  `mkdir -p /opt/pw-browsers/chromium_headless_shell-1208/chrome-headless-shell-linux64 && ln -sf /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell /opt/pw-browsers/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell && touch /opt/pw-browsers/chromium_headless_shell-1208/INSTALLATION_COMPLETE /opt/pw-browsers/chromium_headless_shell-1208/DEPENDENCIES_VALIDATED`
  (for your own scripts you can also pass executablePath '/opt/pw-browsers/chromium-1194/chrome-linux/chrome').
- `docker compose up --build` fails in a sandbox whose build containers cannot reach the HTTPS proxy or trust its CA. Fix (do NOT commit it): copy `backend/Dockerfile` and `frontend/Dockerfile` to `/tmp/<name>.Dockerfile`; right after `FROM ... AS builder` (backend) and after `AS deps` and `AS builder` (frontend) add `COPY --from=ca ca-bundle.crt /etc/ccr-ca.crt` and `ENV SSL_CERT_FILE=/etc/ccr-ca.crt NODE_EXTRA_CA_CERTS=/etc/ccr-ca.crt`; write `/tmp/compose.local.yml` that sets, for `backend` and `frontend`, `build: {dockerfile: /tmp/<name>.Dockerfile, additional_contexts: {ca: /root/.ccr}, network: host, args: {HTTPS_PROXY: ${HTTPS_PROXY}, https_proxy: ${HTTPS_PROXY}}}`; then use `docker compose -f docker-compose.yml -f /tmp/compose.local.yml up -d --build`. Pull `ghcr.io/astral-sh/uv:0.12.5` too if needed.
- `(cd backend && uv sync) && (cd frontend && bun install)`, then `cp .env.example .env && docker compose up -d --build` (with the override above if needed); wait until http://localhost:9095/health and http://localhost:3000 return 200.

## 2. QA
Drive a REAL headless Chromium with Playwright scripts (write them in /tmp/qa/, use NODE_PATH=$PWD/frontend/node_modules or `bun add playwright` there). Register fresh users with unique emails. Take screenshots and look at them (Read tool) to judge visual quality vs Linear, in dark AND light theme. Capture console errors and failed requests (4xx/5xx) on every page. Try edge cases, reload to verify persistence, check every button in your area. You may also call the API with curl.
ALREADY KNOWN / FIXED (do not re-report unless you can show it still reproduces): see `docs/handoff/qa-known-bugs.md`
Report only real, reproduced bugs (functional breakage, data not persisting, errors, broken UI, clearly missing spec features, severe visual problems). No subjective nitpicks. Skeptically re-verify each bug a second time before you count it.

## 3. Fix
Fix every confirmed bug at the root cause, following AGENTS.md and .claude/skills/project-standards/SKILL.md (router -> service -> repository; e2e tests only, no mocks; route/page coverage guards; migrations for model changes). Add/extend e2e tests that would have caught each bug (backend/tests/e2e/test_<x>.py, frontend/e2e/<x>.spec.ts). After a fix, rebuild (`docker compose up -d --build`) and re-check the bug in the browser.
Validate ONLY what you touched: `cd backend && uv run ruff check . && uv run ruff format --check .`; `cd frontend && bun run lint && bun run format:check && bun run typecheck` (+ `bun run build` if routes changed; commit routeTree.gen.ts); the backend test files you touched (`uv run pytest -q tests/e2e/test_<x>.py`); the Playwright specs you touched (`cd frontend && E2E_DB_PORT=55611 E2E_BACKEND_PORT=59611 E2E_FRONTEND_PORT=53611 bunx playwright test e2e/<x>.spec.ts`). Coverage guards may complain on a subset; ignore that. Do NOT run the full suites.
Commit with one-line Conventional Commit messages (no body). Do NOT merge main. If you fixed anything: `git push -u origin <BRANCH>` (retry on network errors). Do not open a PR.

## 4. Final message
Your LAST message must be ONLY this JSON (no prose around it):
{"area":"<AREA>","round":<ROUND>,"branch":"<BRANCH>","pushed":true|false,"confirmed_bugs":[{"title":"...","severity":"critical|major|minor","fixed":true|false,"note":"..."}],"tested":"short summary of what you exercised and found working"}


## Areas

| AREA | FOCUS |
|---|---|
| `auth` | Register (name/email/password, no email verification), login, logout, wrong password errors, duplicate email, redirect to onboarding, onboarding creates workspace + lands on My issues, second workspace creation + workspace switcher, protected routes redirect when logged out, session persistence on reload, landing page. |
| `settings` | All settings pages: workspace general rename/URL key, members invite by email (register a 2nd user first), roles, remove; teams create/edit/join/leave/delete; workflow states add/rename/recolor/reorder/delete with move issues; labels CRUD; account display name; theme toggle light/dark and that light theme is readable everywhere. |
| `issues-list` | Team issues page tabs All/Active/Backlog, list grouped by status, board view with drag and drop between columns + reorder (verify persistence after reload), display options (grouping, ordering, show completed), filters (status, priority, assignee, label, project, cycle, creator), search, inline property pickers on rows, context menu, multi-select + bulk status/priority/assignee/delete, keyboard J/K/Enter/S/P/A, My issues tabs. |
| `create-issue` | Create-issue modal from sidebar button, C shortcut and command palette: all property chips (status, priority, assignee, labels, project, cycle, estimate, due date, parent), rich description, Create more toggle, Cmd+Enter, validation (empty title), identifier numbering ENG-1, ENG-2..., issue appears in lists immediately. Command palette Cmd+K: navigation items, search results, create document/project, theme toggle. Shortcut help (?), G-then-I / G-then-M etc. |
| `issue-detail` | Issue page /ws/issue/ENG-1: edit title, description autosave (reload to verify), all property pickers in the side panel persist, sub-issues add/progress/parent breadcrumb, relations add/remove (blocks/blocked by/related/duplicate), comments add/edit/delete, activity timeline shows readable changes, subscribe/unsubscribe, copy link, favorite star, archive, delete. Open a non-existent identifier. |
| `documents` | Documents list (workspace and team /team/KEY/documents), new document, title + emoji icon, rich-text editor (headings, lists, checklists, code block, quote, links, slash menu, bubble toolbar, markdown shortcuts), autosave + Saved indicator (reload to verify content persisted), issue identifier links inside text navigate to the issue, move to project, project page Documents tab, search documents, delete, favorite. |
| `projects-cycles` | Projects list (workspace + team), create project with all fields, edit status/lead/dates/description, progress % updates when issues are completed, project Issues tab (IssuesView) + new issue prefilled with project, documents tab, delete project. Cycles: create, current/upcoming/past grouping, overlap validation, cycle page issues + progress, complete cycle, edit/delete. |
| `inbox-search` | Multi-user flows with 2 users in one workspace: assigning an issue to user B creates an inbox notification for B (unread badge in sidebar), comment on subscribed issue notifies, status change notifies subscribers, mark read/unread/all read/archive, preview pane. Search page (issues/documents/projects tabs), favorites add/remove + sidebar section, Views page links, mobile width (390px) layout usable, no console errors on every page, no broken links in sidebar. |
