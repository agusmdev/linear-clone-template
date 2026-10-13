# Handoff: Linear clone build

Read this file first to continue the work on another computer.

## 0. Paste this on the new computer

Run this in Claude Code, from inside the cloned repo:

```
/goal Continue the Linear clone in this repo (git@github.com:agusmdev/linear-clone-template, private). Read HANDOFF.md first and follow it. Never ask questions; decide yourself. Use as many parallel agents as possible (worktrees for parallel code changes). Commit to main with one-line Conventional Commit messages and push often. Steps: (1) fetch all fix/r1-* branches; merge the 23 READY branches into main in one batch, then run make check + backend pytest + frontend Playwright once, fix all failures, push; (2) finish the 11 WIP branches (one agent each, own E2E ports, only their own tests), batch-merge, validate, push; (3) rebuild Docker and run browser QA rounds (docs/handoff/qa-loop.workflow.js, start at round 2, fix ROOT/SCRATCH paths) until two rounds in a row find no new confirmed bugs. Done when: QA is dry, make check and make test pass on main, every FEATURES.md item works in a real browser (including register/login with email + password, no email verification, the issue ticketing system and the documents section), and main is pushed.
```

## 1. The goal (from the user, word for word)

> use this template in THIS branch: https://github.com/agusmdev/fullstack-ai-template/tree/t3code/f7740e92 to use as initial step to create a full clone of linear. You must not ask any question. Just create a private repository (linear-clone-template) or something like that, and use main to commit, and push constnatly. You must specify all the main features in a document and make progress as fast as possible (so as many agents as possible) the main features that must be present are the ticketing system, and the documents section. You must validate everything.
> Do not ask questions you decide what's best for this. You can't stop until we have a 100% functional linear clone with a simple login register/email with password (without mail verif)

The user also said: **"go as parallel as possible"** (many agents at the same time).

To continue in Claude Code, set the goal again with `/goal <the text above>`.
Then say: "Continue from HANDOFF.md".

## 2. Where things are

- **Repo:** `git@github.com:agusmdev/linear-clone-template.git` (private).
  - `main` is green: `make check` and `make test` passed at the last merge (commit `70a2841`).
  - The last merged test runs had about 380 backend tests and about 120 Playwright tests.
- **Feature spec:** `FEATURES.md`. All 41 feature IDs are marked `done`.
- **API contract:** `docs/API.md`.
- **UX reference:** `docs/LINEAR_UX.md`.
- **Design system:** `frontend/DESIGN.md`.

### What is built on `main`

| Area | What it has |
|---|---|
| Auth | Register (name, email, password), login, logout. No email verification. |
| Workspace and onboarding | Onboarding, workspaces, switcher, settings (general, members/invite, teams, workflow states, labels, account) |
| Issues (ticketing) | `ENG-12` identifiers, list and board views (drag and drop), filters, display options, bulk actions, create modal, My issues |
| Issue detail | Description editor, properties panel, sub-issues, relations, comments, activity, subscribe, archive, delete |
| Documents | List, TipTap editor with slash menu, autosave, move to project, issue links, project Documents tab |
| Projects and cycles | Projects with progress and an issues tab; cycles with current, upcoming and past |
| Inbox | Notifications for assign, comment and status change; unread badge |
| Productivity | Command palette (Cmd+K), keyboard shortcuts, search page, favorites, Views page, dark/light theme |

### Work that is NOT on `main` yet: QA round 1 bug fixes

QA round 1 tested the running app in a real browser and found 36 confirmed bugs. They are mostly minor; some are major. Each group of bugs has its own branch, and **all branches are pushed to origin**.

**A. Ready branches.** Each has a finished commit and passed its own checks. Merge them all into `main`:

| Branch (suffix of `fix/r1-…`) | Bug(s) |
|---|---|
| 1-workspace-switcher-sidebar-header- | Long workspace name overlaps the sidebar icons |
| 2-protected-routes-workspace-access | "Workspace not found" page has no navigation |
| 3-register | Duplicate email shows a raw backend message |
| 4-login | Login errors show whether an account exists |
| 5-register-api | Whitespace-only display name is accepted |
| 6-settings-labels-…-colorpicker- | Enter in the ColorPicker hex field submits the outer form (major) |
| 7-theme-light-all-size-sm-… | Light theme: small primary/destructive buttons have dark text (major) |
| 8-settings-team-workflow | Duplicate workflow state names are allowed |
| 9-theme-light-status-icons | Light theme: Todo icon is almost invisible |
| 10-settings-teams-workspace | Stale queries give 404s after a team is deleted or a workspace is left |
| 12-issues-list-search | Search box keeps the old text after "Clear filters" |
| 13-my-issues-tabs-filters | A filter carries over to a tab where it is hidden |
| 14-issues-list-search-backend- | LIKE wildcards are not escaped in issue search |
| 15-issues-list-multi-select-bulk-bar | Escape does not clear the selection |
| 16-issues-list-bulk-bar-visual | Bulk bar covers the last row |
| 17-create-issue-modal | Double submit makes duplicate issues; long title breaks the modal (major) |
| 18-create-issue-modal-rich-description | Escape in the slash menu closes the modal; Cmd+Enter adds a stray break (major) |
| 19-command-palette-cmd-k- | Async search results cannot be selected with Enter (major) |
| 21-create-issue-modal-validation | Titles can contain newlines |
| 23-issue-detail-delete | Deleting an issue refetches it 6 times (404s) |
| 24-issue-detail-backend-validation | Whitespace-only titles and comments are accepted |
| 26-documents-autosave | Edits made just before a reload are lost (major) |
| 27-documents-favorites | Sidebar favorite keeps an old or deleted document |

**B. Unfinished branches.** The last commit is `wip: unfinished bug fix (not validated)`. Finish the fix, add the e2e tests, then validate:

| Branch (suffix of `fix/r1-…`) | Bug |
|---|---|
| 0-auth-onboarding-workspace-creation- | The workspace URL key accepts reserved route names (`login`, `register`, `onboarding`, `items`, `oauth`, `api`) (major) |
| 11-issues-list-keyboard-shortcuts-inline-pickers | After an S/P/A picker closes, focus stays on the picker and J/K stop working (major). It has one real fix commit plus WIP. |
| 20-create-issue-modal-create-more | With "Create more" on, focus leaves the title after create |
| 22-issue-detail-favorites | Sidebar favorites keep a deleted issue. It has one real fix commit plus WIP; the WIP touches `cycles.tsx`, so check whether that change belongs there. |
| 25-issue-detail-activity | Relation and sub-issue changes are not in the activity timeline |
| 28-documents-search | Document search matches raw HTML and does not escape wildcards |
| 29-documents-save-indicator | "Saved" shows while there are unsaved changes |
| 30-documents-responsive-header | On mobile, the project chip overlaps the breadcrumbs |
| 31-documents-create | No UI to make a document inside a team (DOC-2) |
| 32-projects-overview-properties-start-target-date- | A date typed with the keyboard saves the wrong year (major) |
| 33-projects-edit-dates-validation | The target date can be before the start date |

The `feat/*` branches are all merged already, so you can ignore them.

## 3. Next steps (in order)

1. **Set up the new computer.** You need Docker, [uv](https://docs.astral.sh/uv/), [bun](https://bun.sh/) and git.
   ```bash
   git clone git@github.com:agusmdev/linear-clone-template.git && cd linear-clone-template
   git fetch origin '+refs/heads/fix/*:refs/heads/fix/*'
   (cd backend && uv sync) && (cd frontend && bun install && bunx playwright install chromium)
   cp .env.example .env && docker compose up -d --build   # app at http://localhost:3000
   ```
2. **Merge the ready branches (group A).** Use one agent; it merges them one after another into `main`.
   - Resolve conflicts so that both fixes stay.
   - Regenerate `frontend/src/routeTree.gen.ts` with `bun run build`.
   - Keep one Alembic head.
   - Then validate ONE time:
     ```bash
     make check
     cd backend && uv run pytest -q
     cd frontend && bun run test:e2e
     ```
   - Then push.
3. **Finish the group B branches**, in parallel, one agent per branch in a git worktree. Then batch-merge them the same way.
4. **Run QA again until two rounds in a row find no new bugs.**
   - Rebuild Docker first (`docker compose up -d --build`).
   - The loop script is `docs/handoff/qa-loop.workflow.js`, for the Claude Code Workflow tool. Before you run it:
     - Change `ROOT` and `SCRATCH` at the top to the new paths.
     - Change `MAX_ROUNDS` as needed.
     - Start it from round 2 (set `let round = 2`), because round 1 is already done.
   - QA areas: auth, settings, issues-list, create-issue, issue-detail, documents, projects-cycles, inbox-search.
   - The inbox/search area found no bugs in round 1. Check it again.
5. When QA is dry and `make check` + `make test` pass on `main`, update FEATURES.md. The goal is then met.

## 4. Lessons from this session (important)

- **Merge in batches.** A per-branch merge queue that runs the full suites after each merge is far too slow with 30+ fix branches. Merge all of them, then validate one time.
- **Fixers run only their own tests.** About 30 fixers that each ran full Playwright suites pushed the machine load to about 40, and the tests became flaky. Fixers must run only the test files they touch. The batch merge runs the full suites.
- **Parallel e2e runs need their own ports.** Give each parallel Playwright run its own `E2E_DB_PORT` / `E2E_BACKEND_PORT` / `E2E_FRONTEND_PORT`. The backend suite picks free ports by itself.
- **zsh gotcha.** Never name a shell variable `path` in zsh. It overwrites `PATH`.
- **Commit messages.** One short Conventional Commit subject line only, with no body.
- **Pattern that worked:**
  - A foundation phase for the data model and API contract.
  - Data-agnostic components built in parallel (editor, board, palette).
  - Full-stack slices in worktrees.
  - A merge queue.
  - An integration agent.
  - The QA loop.
- **Other workflow scripts.** The slice workflow script is in `docs/handoff/slices.workflow.js`, for reference.

## 5. Project rules

Follow `AGENTS.md` and `.claude/skills/project-standards/SKILL.md`:
- Router → service → repository.
- Tests are end-to-end only. No mocks.
- The route-coverage guards require that every route and every page has a test.
- A model change needs a migration.
- New dependencies must be pinned and at least 7 days old.
