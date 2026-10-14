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
  - `main` is green: `make check` and `make test` pass (449 backend tests and 257 Playwright tests).
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

### QA status

- All QA round 1 fix branches (`fix/r1-*`, 34 bugs) are merged into `main`.
- QA rounds 2 to 10 and a cross-area user-journey pass found and fixed about 110 more bugs (`fix/r2-*` .. `fix/r10-*`, `fix/journey-*`, all merged). Bugs per round: r2 ~19, r3 ~29, r4 ~13, r5 5, r6 3, r7 ~6, r8 5, r9 4, journey 15, r10 6.
- Every bug found so far, and the few accepted edge cases, are in `docs/handoff/qa-known-bugs.md`.
- A browser acceptance pass checked all 41 FEATURES.md items; all work.
- `make check`, the backend suite (449 tests) and the Playwright suite (257 tests) pass on `main`.
- Round 11 is the next QA round (see section 3); QA is done after two dry rounds in a row.

## 3. How to continue QA

QA runs as **one cloud session per area** (Claude Code on the web), not as local agents: each session
has its own container, so eight Docker stacks and Playwright runs do not fight for one machine's CPU.

1. Start one session per area on `main` with this prompt (ROUND = next round number):
   `Read docs/handoff/qa-session.md and follow it exactly. ROUND=<n>, AREA=<area>, BRANCH=fix/r<n>-<area>.
   Known bugs: docs/handoff/qa-known-bugs.md. Never ask questions. Your last message must be only the JSON described in that file.`
   Areas: auth, settings, issues-list, create-issue, issue-detail, documents, projects-cycles, inbox-search.
2. Each session tests its area in a real browser, fixes what it confirms on its own branch with e2e
   tests, runs only the tests it touched and pushes the branch. Its last message is a JSON report.
3. Merge all `fix/r<n>-*` branches into `main` in one batch, run `make check`, the backend suite and
   the Playwright suite once, fix failures, push. Add the round's bugs to `qa-known-bugs.md`.
4. QA is done when two rounds in a row confirm no new bugs.

The local alternative is `docs/handoff/qa-loop.workflow.js` (Workflow tool). Its concurrency is capped
at CPUs - 2 agents, which is slow on a small machine.

### Sandbox notes

- Docker Hub may rate-limit pulls: pull through `mirror.gcr.io/library/<image>` and retag.
- Playwright may want a newer headless shell than the one installed; see `docs/handoff/qa-session.md`.
- `docker compose up --build` needs the proxy CA inside the build; see `docs/handoff/qa-session.md`.

## 4. Lessons from this session (important)

- **Merge in batches.** A per-branch merge queue that runs the full suites after each merge is far too slow with 30+ fix branches. Merge all of them, then validate one time.
- **Fixers run only their own tests.** About 30 fixers that each ran full Playwright suites pushed the machine load to about 40, and the tests became flaky. Fixers must run only the test files they touch. The batch merge runs the full suites.
- **Parallel e2e runs need their own ports.** Give each parallel Playwright run its own `E2E_DB_PORT` / `E2E_BACKEND_PORT` / `E2E_FRONTEND_PORT`. The backend suite picks free ports by itself.
- **zsh gotcha.** Never name a shell variable `path` in zsh. It overwrites `PATH`.
- **Commit messages.** One short Conventional Commit subject line only, with no body.
- **QA in cloud sessions.** One cloud session per QA area gives each its own CPU and Docker; it was far faster than local agents on a 4-CPU machine.
- **Merges can compile and still break.** A merge once left an import of a function another branch had moved: `make check` passed, the app did not start. After a batch merge, run `cd backend && uv run python -c "import app.main"` before the suites.
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
