export const meta = {
  name: 'linear-qa-loop',
  description: 'Browser QA of the running Linear clone by area, verify bugs, fix in worktrees, merge+push, repeat until dry',
  phases: [{ title: 'QA' }, { title: 'Fix' }, { title: 'Merge' }, { title: 'Redeploy' }],
}

const ROOT = '/home/user/linear-clone-template'
const SCRATCH = '/tmp/claude-0/-home-user-linear-clone-template/0c354a77-8d14-54f5-8ce1-601d571a9e8b/scratchpad/qa'

const AREAS = [
  { key: 'auth', focus: 'Register (name/email/password, no email verification), login, logout, wrong password errors, duplicate email, redirect to onboarding, onboarding creates workspace + lands on My issues, second workspace creation + workspace switcher, protected routes redirect when logged out, session persistence on reload, landing page.' },
  { key: 'settings', focus: 'All settings pages: workspace general rename/URL key, members invite by email (register a 2nd user first), roles, remove; teams create/edit/join/leave/delete; workflow states add/rename/recolor/reorder/delete with move issues; labels CRUD; account display name; theme toggle light/dark and that light theme is readable everywhere.' },
  { key: 'issues-list', focus: 'Team issues page tabs All/Active/Backlog, list grouped by status, board view with drag and drop between columns + reorder (verify persistence after reload), display options (grouping, ordering, show completed), filters (status, priority, assignee, label, project, cycle, creator), search, inline property pickers on rows, context menu, multi-select + bulk status/priority/assignee/delete, keyboard J/K/Enter/S/P/A, My issues tabs.' },
  { key: 'create-issue', focus: 'Create-issue modal from sidebar button, C shortcut and command palette: all property chips (status, priority, assignee, labels, project, cycle, estimate, due date, parent), rich description, Create more toggle, Cmd+Enter, validation (empty title), identifier numbering ENG-1, ENG-2..., issue appears in lists immediately. Command palette Cmd+K: navigation items, search results, create document/project, theme toggle. Shortcut help (?), G-then-I / G-then-M etc.' },
  { key: 'issue-detail', focus: 'Issue page /ws/issue/ENG-1: edit title, description autosave (reload to verify), all property pickers in the side panel persist, sub-issues add/progress/parent breadcrumb, relations add/remove (blocks/blocked by/related/duplicate), comments add/edit/delete, activity timeline shows readable changes, subscribe/unsubscribe, copy link, favorite star, archive, delete. Open a non-existent identifier.' },
  { key: 'documents', focus: 'Documents list, new document, title + emoji icon, rich-text editor (headings, lists, checklists, code block, quote, links, slash menu, bubble toolbar, markdown shortcuts), autosave + Saved indicator (reload to verify content persisted), issue identifier links inside text navigate to the issue, move to project, project page Documents tab, search documents, delete, favorite.' },
  { key: 'projects-cycles', focus: 'Projects list (workspace + team), create project with all fields, edit status/lead/dates/description, progress % updates when issues are completed, project Issues tab (IssuesView) + new issue prefilled with project, documents tab, delete project. Cycles: create, current/upcoming/past grouping, overlap validation, cycle page issues + progress, complete cycle, edit/delete.' },
  { key: 'inbox-search', focus: 'Multi-user flows with 2 users in one workspace: assigning an issue to user B creates an inbox notification for B (unread badge in sidebar), comment on subscribed issue notifies, status change notifies subscribers, mark read/unread/all read/archive, preview pane. Search page (issues/documents/projects tabs), favorites add/remove + sidebar section, Views page links, mobile width (390px) layout usable, no console errors on every page, no broken links in sidebar.' },
]

const BUGS = {
  type: 'object',
  properties: {
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          area: { type: 'string' },
          steps: { type: 'string' },
          expected: { type: 'string' },
          actual: { type: 'string' },
          suspected_files: { type: 'string' },
        },
        required: ['title', 'severity', 'area', 'steps', 'expected', 'actual'],
      },
    },
    tested: { type: 'string', description: 'what you exercised and found working' },
  },
  required: ['bugs', 'tested'],
}

const qaPrompt = (a, round) => `
You are a meticulous QA engineer testing a Linear.app clone (round ${round}). The full stack runs in Docker: frontend http://localhost:3000, backend http://localhost:9095 (docs at /docs). Source code (read-only for you) is in ${ROOT}; spec in ${ROOT}/FEATURES.md, UX reference ${ROOT}/docs/LINEAR_UX.md.
YOUR AREA: ${a.key}. ${a.focus}
How: drive a REAL headless Chromium with Playwright scripts. Write them in your own dir ${SCRATCH}/r${round}-${a.key}/ (mkdir it; create a package.json there and \`bun add playwright@1.58.0\` or reuse ${ROOT}/frontend/node_modules via NODE_PATH; chromium is installed). Register fresh users with unique emails (e.g. qa-${a.key}-r${round}-<n>@example.com) so you do not collide with other QA agents running at the same time. Take screenshots (read them with the Read tool) to judge visual quality vs Linear. Capture console errors and failed network requests (4xx/5xx) on every page. You may also call the API with curl.
Do NOT modify files in ${ROOT}. Be thorough: try edge cases, reload to verify persistence, check every button in your area works.
Report ONLY real, reproduced bugs (functional breakage, data not persisting, errors, broken UI, clearly missing spec features, severe visual problems). Do not report subjective nitpicks as major. For each: exact steps, expected, actual, suspected files. Return {bugs, tested}.`

const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real', 'reason'],
}

let mergeChain = Promise.resolve()
function enqueueMerge(label, report, round) {
  const p = mergeChain.then(() => agent(`
MERGE QUEUE for the Linear clone. Work in the MAIN checkout ${ROOT} (branch main); you are the only agent there right now. Read AGENTS.md + .claude/skills/project-standards/SKILL.md first.
Merge branch ${label} (a bug-fix branch) into main. Fixer report:
---
${report}
---
1. git status must be clean (commit leftovers if any) then git merge --no-ff --no-edit ${label}. Resolve conflicts keeping both intents; regenerate routeTree.gen.ts via bun run build and lockfiles via bun install / uv lock; keep ONE alembic head.
2. Validate and fix every failure (never delete or skip tests):
   cd ${ROOT}/backend && uv sync && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
   cd ${ROOT}/frontend && bun install && bun run lint && bun run format:check && bun run typecheck && bun run build
   cd ${ROOT}/frontend && E2E_DB_PORT=55590 E2E_BACKEND_PORT=59590 E2E_FRONTEND_PORT=53590 bun run test:e2e
3. Commit any fixes (one-line conventional message) and git push origin main.
Return: merged?, validation pass counts, fixes, push result.`, { label: `merge:${label}`, phase: 'Merge' }))
  mergeChain = p.then(() => undefined, () => undefined)
  return p
}

const seen = new Set()
const allFixed = []
let dry = 0
let round = 2
const MAX_ROUNDS = 6

while (dry < 2 && round <= MAX_ROUNDS) {
  phase('QA')
  const found = (await parallel(AREAS.map(a => () =>
    agent(qaPrompt(a, round), { label: `qa:r${round}:${a.key}`, phase: 'QA', schema: BUGS })
  ))).filter(Boolean)
  const bugs = found.flatMap((r, ri) => r.bugs.map(b => ({ ...b, qa: AREAS[ri] ? AREAS[ri].key : 'misc' })))
  const key = b => (b.area + '|' + b.title).toLowerCase().replace(/[^a-z0-9|]+/g, ' ').trim()
  const fresh = bugs.filter(b => !seen.has(key(b)))
  fresh.forEach(b => seen.add(key(b)))
  log(`Round ${round}: ${bugs.length} bugs reported, ${fresh.length} new`)
  if (fresh.length === 0) { dry++; round++; continue }
  dry = 0

  // Verify each bug quickly against the running stack + code.
  const verified = (await parallel(fresh.map((b, i) => () =>
    agent(`Skeptically verify this bug report against the running Linear clone (frontend http://localhost:3000, backend http://localhost:9095, code in ${ROOT}, read-only). Reproduce it (Playwright script in ${SCRATCH}/verify-r${round}-${i}/ or curl, or by reading code when reproduction is impractical). Return real=true only if it reproduces or the code clearly has the defect.\nBUG: ${JSON.stringify(b)}`,
      { label: `verify:r${round}:${i}`, phase: 'QA', schema: VERDICT, effort: 'low' })
      .then(v => (v && v.real ? { ...b, why: v.reason } : null))
  ))).filter(Boolean)
  log(`Round ${round}: ${verified.length} bugs confirmed`)
  if (verified.length === 0) { dry++; round++; continue }

  // Group by area -> one fixer per area (worktree), merge each as soon as done.
  const groups = {}
  for (const b of verified) { const { qa, ...rest } = b; const g = round === 1 ? b.area : qa; (groups[g] = groups[g] || []).push(round === 1 ? rest : rest) }
  const groupList = Object.entries(groups)
  phase('Fix')
  const branchOf = (area, gi) => `fix/r${round}-${gi}-${area.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  const fixes = await parallel(groupList.map(([area, list], gi) => () => agent(round === 1 ? `
You fix bugs in a Linear.app clone. You are in a git WORKTREE of ${ROOT}. FIRST: git checkout -b fix/r${round}-${gi}-${area.replace(/[^a-z0-9]+/gi, '-').toLowerCase()} . Read AGENTS.md, .claude/skills/project-standards/SKILL.md (mandatory rules, e2e-only tests), frontend/DESIGN.md.
Fix ALL of these confirmed bugs (area ${area}) at the root cause, and add/extend e2e tests (backend tests/e2e and/or Playwright frontend/e2e) that would have caught each:
${JSON.stringify(list, null, 1)}
Validate (fix all failures): cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q ; cd frontend && bun install && bun run lint && bun run format:check && bun run typecheck && bun run build && E2E_DB_PORT=${55700 + gi * 10} E2E_BACKEND_PORT=${59700 + gi * 10} E2E_FRONTEND_PORT=${53700 + gi * 10} bun run test:e2e  (ONLY these ports; other fixers run concurrently).
Then git merge --no-edit main, re-validate, commit (one-line conventional messages). Do not push. Return: branch name (exact), each bug fixed or not (why), tests added, validation results.` : `
You fix bugs in a Linear.app clone. You are in a git WORKTREE of ${ROOT}. FIRST: git checkout -b ${branchOf(area, gi)} (if it already exists, git checkout it and continue from its commits). Read AGENTS.md, .claude/skills/project-standards/SKILL.md (mandatory rules, e2e-only tests), frontend/DESIGN.md.
Fix ALL of these confirmed bugs (area ${area}) at the root cause, and add/extend e2e tests that would have caught each:
${JSON.stringify(list, null, 1)}
The machine is heavily loaded by many parallel agents: run static checks (cd backend && uv run ruff check . && uv run ruff format --check . ; cd frontend && bun install && bun run lint && bun run format:check && bun run typecheck) and ONLY the test files you touched: backend \`uv run pytest -q tests/e2e/test_<x>.py\` and frontend \`E2E_DB_PORT=${55700 + gi * 10} E2E_BACKEND_PORT=${59700 + gi * 10} E2E_FRONTEND_PORT=${53700 + gi * 10} bunx playwright test e2e/<x>.spec.ts\` (the coverage guards may complain when running a subset; ignore that). A batch merge agent runs the full suites afterwards.
Commit (one-line conventional messages). Do not push. Return: branch name (exact), each bug fixed or not (why), tests added, validation results.`,
      { label: `fix:r${round}:${area}`, phase: 'Fix', isolation: 'worktree' }).then(report => ({ area, branch: branchOf(area, gi), report }))))

  phase('Merge')
  const merged = await agent(`
BATCH MERGE for the Linear clone, round ${round}. Work in the MAIN checkout ${ROOT} (branch main); you are the only agent there. Read AGENTS.md + .claude/skills/project-standards/SKILL.md first.
Merge ALL these bug-fix branches into main, one after another (git merge --no-ff --no-edit <branch>; skip a branch only if it does not exist or has no commits beyond main). Fixer reports:
${JSON.stringify(fixes.filter(Boolean).map(f => ({ branch: f.branch, report: (f.report || '').slice(0, 1500) })), null, 1)}
Also merge any other local branch matching fix/r${round}-* that has commits not in main.
Resolve conflicts keeping BOTH intents (read both sides carefully; several fixers touched the same files). Regenerate routeTree.gen.ts with bun run build, lockfiles with bun install / uv lock; keep ONE alembic head.
After all merges, validate ONCE and fix every failure (never delete or skip tests; flaky timing -> make the test robust):
   cd ${ROOT}/backend && uv sync && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
   cd ${ROOT}/frontend && bun install && bun run lint && bun run format:check && bun run typecheck && bun run build
   cd ${ROOT}/frontend && E2E_DB_PORT=55590 E2E_BACKEND_PORT=59590 E2E_FRONTEND_PORT=53590 bun run test:e2e
Commit fixes (one-line conventional messages) and git push origin main after the merges and again after fixes.
Return: branches merged, conflicts resolved, final validation pass counts, push result.`, { label: `merge:r${round}`, phase: 'Merge' })
  allFixed.push(...fixes.filter(Boolean).map(f => ({ area: f.area, merge: merged })))

  phase('Redeploy')
  await agent(`In ${ROOT} (main, already merged and pushed), rebuild and restart the Docker stack so QA tests the latest code: cd ${ROOT} && docker compose up -d --build. Wait until backend /health returns 200 and http://localhost:3000 returns 200 (poll with curl up to 5 minutes). If the build fails, fix the cause (commit + push on main). Return status.`, { label: `redeploy:r${round}`, phase: 'Redeploy', effort: 'low' })
  round++
}

return { rounds: round - 1, dry, totalSeen: seen.size, fixes: allFixed.map(f => ({ area: f.area, merge: (f.merge || '').slice(0, 600) })) }
