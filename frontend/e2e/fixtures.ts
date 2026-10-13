/**
 * Shared fixtures and helpers for every e2e spec.
 *
 *   import { test, expect } from './fixtures'
 *
 * Everything here drives the real stack that playwright.config.ts starts:
 * Postgres in Docker, the FastAPI backend (real migrations) and the frontend
 * dev server. Seed data through the backend's public HTTP API (helpers below).
 * Never mock: ESLint rejects page.route() & co. and mock libraries in e2e/.
 *
 * Adding a feature:
 *   1. Write e2e/<feature>.spec.ts that imports from './fixtures'.
 *   2. Put API helpers for the new resource here, next to createItem().
 *   3. Visit every new page from a spec, and use every new endpoint in
 *      src/lib/api-endpoints.ts from a spec or a helper here. e2e/guards.spec.ts
 *      fails for a route or an endpoint that no test uses.
 *   4. Never skip a test, and never stub the network: ESLint fails on both.
 *
 * Running: `bun run test:e2e` starts the whole stack and stops it after. To keep
 * a stack you started yourself, set E2E_REUSE=1 (see playwright.config.ts).
 *
 * Fixtures:
 *   api         APIRequestContext with baseURL = the real backend (no auth header).
 *   user        A new user registered through POST /auth/register, with its session token.
 *   authedPage  A page in its own browser context, already signed in as `user`.
 *   loginAs     (user) => a new signed-in page for any other user.
 */
import { randomUUID } from 'node:crypto'
import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
  type Request,
} from '@playwright/test'
import { AUTH_TOKEN_KEY } from '../src/lib/auth'
import type { AuthSessionResponse } from '../src/types/auth'
import type { CreateDocumentData, Document, DocumentSummary } from '../src/types/document'
import type { CreateIssueData, Issue, UpdateIssueData } from '../src/types/issue'
import type { CreateItemData, Item, ItemsResponse } from '../src/types/item'
import type { Label } from '../src/types/label'
import type { CreateProjectData, Project, UpdateProjectData } from '../src/types/project'
import type { Page as ApiPage } from '../src/types/page'
import type { Team, WorkflowState } from '../src/types/team'
import type { User } from '../src/types/user'
import type { CreateWorkspaceData, Workspace, WorkspaceMember } from '../src/types/workspace'
import { BACKEND_URL, FRONTEND_URL } from './support/stack'

export { expect }
export type { Locator, Page } from '@playwright/test'
export { BACKEND_URL, FRONTEND_URL }

export interface TestUser {
  email: string
  password: string
  /** Real session id from the backend. The app sends it as `Authorization: Bearer <token>`. */
  token: string
}

/** Meets the register form rules (8+ characters). */
export const PASSWORD = 'Correct-Horse-42'

/** A new address for every call, so tests never share users. Uses a real TLD: the backend rejects reserved ones. */
export function uniqueEmail(label = 'user'): string {
  return `e2e-${label}-${randomUUID()}@example.com`
}

async function expectOk(response: APIResponse, what: string): Promise<void> {
  if (!response.ok()) {
    throw new Error(`${what} failed: HTTP ${response.status()} ${await response.text()}`)
  }
}

export function authHeaders(user: Pick<TestUser, 'token'>): Record<string, string> {
  return { Authorization: `Bearer ${user.token}` }
}

// ---------------------------------------------------------------------------
// Real backend API helpers (seeding and checking state). Add new resources here.
// ---------------------------------------------------------------------------

export async function registerUser(
  api: APIRequestContext,
  email = uniqueEmail(),
  password = PASSWORD
): Promise<TestUser> {
  const response = await api.post('/auth/register', { data: { email, raw_password: password } })
  await expectOk(response, `POST /auth/register (${email})`)
  const session = (await response.json()) as AuthSessionResponse
  return { email, password, token: session.id }
}

/** Signs in through POST /auth/login and returns the new session token. */
export async function loginUser(
  api: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const response = await api.post('/auth/login', { data: { email, password } })
  await expectOk(response, `POST /auth/login (${email})`)
  return ((await response.json()) as AuthSessionResponse).id
}

export async function createItem(
  api: APIRequestContext,
  owner: TestUser,
  data: CreateItemData
): Promise<Item> {
  const response = await api.post('/items', { data, headers: authHeaders(owner) })
  await expectOk(response, 'POST /items')
  return (await response.json()) as Item
}

/** Creates the items one after another, so the list order (created_at) follows `names`. */
export async function createItems(
  api: APIRequestContext,
  owner: TestUser,
  names: string[]
): Promise<Item[]> {
  const items: Item[] = []
  for (const name of names) items.push(await createItem(api, owner, { name }))
  return items
}

export async function listItems(api: APIRequestContext, owner: TestUser): Promise<Item[]> {
  const response = await api.get('/items?size=100', { headers: authHeaders(owner) })
  await expectOk(response, 'GET /items')
  return ((await response.json()) as ItemsResponse).items
}

export async function getMe(api: APIRequestContext, user: TestUser): Promise<User> {
  const response = await api.get('/users/me', { headers: authHeaders(user) })
  await expectOk(response, 'GET /users/me')
  return (await response.json()) as User
}

/** A unique URL key (lowercase letters, digits, dashes). */
export function uniqueUrlKey(label = 'ws'): string {
  return `${label}-${randomUUID().slice(0, 8)}`
}

/** POST /workspaces: the workspace comes with a first team, its 6 states and 3 labels. */
export async function createWorkspace(
  api: APIRequestContext,
  owner: TestUser,
  data: Partial<CreateWorkspaceData> = {}
): Promise<Workspace> {
  const payload: CreateWorkspaceData = { name: 'Acme', url_key: uniqueUrlKey(), ...data }
  const response = await api.post('/workspaces', { data: payload, headers: authHeaders(owner) })
  await expectOk(response, 'POST /workspaces')
  return (await response.json()) as Workspace
}

export async function listWorkspaces(api: APIRequestContext, user: TestUser): Promise<Workspace[]> {
  const response = await api.get('/workspaces', { headers: authHeaders(user) })
  await expectOk(response, 'GET /workspaces')
  return (await response.json()) as Workspace[]
}

export async function getWorkspaceByUrlKey(
  api: APIRequestContext,
  user: TestUser,
  urlKey: string
): Promise<Workspace> {
  const response = await api.get(`/workspaces/${urlKey}`, { headers: authHeaders(user) })
  await expectOk(response, 'GET /workspaces/{url_key}')
  return (await response.json()) as Workspace
}

export async function listMembers(
  api: APIRequestContext,
  user: TestUser,
  workspaceId: string
): Promise<WorkspaceMember[]> {
  const response = await api.get(`/workspaces/${workspaceId}/members`, {
    headers: authHeaders(user),
  })
  await expectOk(response, 'GET /workspaces/{id}/members')
  return (await response.json()) as WorkspaceMember[]
}

export async function listTeams(
  api: APIRequestContext,
  user: TestUser,
  workspaceId: string
): Promise<Team[]> {
  const response = await api.get(`/workspaces/${workspaceId}/teams`, {
    headers: authHeaders(user),
  })
  await expectOk(response, 'GET /workspaces/{id}/teams')
  return (await response.json()) as Team[]
}

export async function listLabels(
  api: APIRequestContext,
  user: TestUser,
  workspaceId: string
): Promise<Label[]> {
  const response = await api.get(`/workspaces/${workspaceId}/labels`, {
    headers: authHeaders(user),
  })
  await expectOk(response, 'GET /workspaces/{id}/labels')
  return (await response.json()) as Label[]
}

export async function listStates(
  api: APIRequestContext,
  user: TestUser,
  teamId: string
): Promise<WorkflowState[]> {
  const response = await api.get(`/teams/${teamId}/states`, { headers: authHeaders(user) })
  await expectOk(response, 'GET /teams/{id}/states')
  return (await response.json()) as WorkflowState[]
}

export async function createIssue(
  api: APIRequestContext,
  user: TestUser,
  data: CreateIssueData
): Promise<Issue> {
  const response = await api.post('/issues', { data, headers: authHeaders(user) })
  await expectOk(response, 'POST /issues')
  return (await response.json()) as Issue
}

/** GET /issues?workspace_id=…: the first page (up to 100 issues, archived left out). */
export async function listIssues(
  api: APIRequestContext,
  user: TestUser,
  workspaceId: string
): Promise<ApiPage<Issue>> {
  const response = await api.get(`/issues?workspace_id=${workspaceId}&size=100`, {
    headers: authHeaders(user),
  })
  await expectOk(response, 'GET /issues')
  return (await response.json()) as ApiPage<Issue>
}

export async function getIssue(
  api: APIRequestContext,
  user: TestUser,
  issueId: string
): Promise<Issue> {
  const response = await api.get(`/issues/${issueId}`, { headers: authHeaders(user) })
  await expectOk(response, 'GET /issues/{id}')
  return (await response.json()) as Issue
}

export async function getIssueByIdentifier(
  api: APIRequestContext,
  user: TestUser,
  workspaceId: string,
  identifier: string
): Promise<Issue> {
  const response = await api.get(`/workspaces/${workspaceId}/issues/by-identifier/${identifier}`, {
    headers: authHeaders(user),
  })
  await expectOk(response, 'GET /workspaces/{id}/issues/by-identifier/{identifier}')
  return (await response.json()) as Issue
}

export async function updateIssue(
  api: APIRequestContext,
  user: TestUser,
  issueId: string,
  data: UpdateIssueData
): Promise<Issue> {
  const response = await api.patch(`/issues/${issueId}`, { data, headers: authHeaders(user) })
  await expectOk(response, 'PATCH /issues/{id}')
  return (await response.json()) as Issue
}

export async function deleteIssue(
  api: APIRequestContext,
  user: TestUser,
  issueId: string
): Promise<void> {
  const response = await api.delete(`/issues/${issueId}`, { headers: authHeaders(user) })
  await expectOk(response, 'DELETE /issues/{id}')
}

export async function createProject(
  api: APIRequestContext,
  user: TestUser,
  data: CreateProjectData
): Promise<Project> {
  const response = await api.post('/projects', { data, headers: authHeaders(user) })
  await expectOk(response, 'POST /projects')
  return (await response.json()) as Project
}

/** GET /workspaces/{id}/projects, with the optional `status` / `team_id` filters. */
export async function listProjects(
  api: APIRequestContext,
  user: TestUser,
  workspaceId: string,
  query = ''
): Promise<Project[]> {
  const response = await api.get(`/workspaces/${workspaceId}/projects` + query, {
    headers: authHeaders(user),
  })
  await expectOk(response, 'GET /workspaces/{id}/projects')
  return (await response.json()) as Project[]
}

/** GET /projects/{id}; returns null on 404. */
export async function getProject(
  api: APIRequestContext,
  user: TestUser,
  projectId: string
): Promise<Project | null> {
  const response = await api.get(`/projects/${projectId}`, { headers: authHeaders(user) })
  if (response.status() === 404) return null
  await expectOk(response, 'GET /projects/{id}')
  return (await response.json()) as Project
}

export async function updateProject(
  api: APIRequestContext,
  user: TestUser,
  projectId: string,
  data: UpdateProjectData
): Promise<Project> {
  const response = await api.patch(`/projects/${projectId}`, { data, headers: authHeaders(user) })
  await expectOk(response, 'PATCH /projects/{id}')
  return (await response.json()) as Project
}

export async function createDocument(
  api: APIRequestContext,
  user: TestUser,
  data: CreateDocumentData
): Promise<Document> {
  const response = await api.post('/documents', { data, headers: authHeaders(user) })
  await expectOk(response, 'POST /documents')
  return (await response.json()) as Document
}

/** GET /documents?workspace_id=…: the first page (up to 100), newest edit first. */
export async function listDocuments(
  api: APIRequestContext,
  user: TestUser,
  workspaceId: string
): Promise<ApiPage<DocumentSummary>> {
  const response = await api.get(`/documents?workspace_id=${workspaceId}&size=100`, {
    headers: authHeaders(user),
  })
  await expectOk(response, 'GET /documents')
  return (await response.json()) as ApiPage<DocumentSummary>
}

/** GET /documents/{id}: the response itself, so a spec can also check a 404. */
export function fetchDocument(
  api: APIRequestContext,
  user: TestUser,
  documentId: string
): Promise<APIResponse> {
  return api.get(`/documents/${documentId}`, { headers: authHeaders(user) })
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Error toasts (sonner). Assert with toContainText(title) and the backend message. */
export function errorToast(page: Page) {
  return page.locator('[data-sonner-toast][data-type="error"]')
}

/** The value the app keeps in localStorage for the session, or null when signed out. */
export function storedToken(page: Page): Promise<string | null> {
  return page.evaluate(key => window.localStorage.getItem(key), AUTH_TOKEN_KEY)
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NETWORK_CHANGED = 'net::ERR_NETWORK_CHANGED'
const MODULE_LOAD_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed/

/**
 * Watches every page of a browser context during one test:
 *
 * - An uncaught exception in the app (React hydration errors included) fails
 *   the test. Call the returned function after the test to check.
 * - Host network changes are survived. When Docker on the same machine starts
 *   containers or networks, Chromium can abort in-flight requests with
 *   net::ERR_NETWORK_CHANGED, even to 127.0.0.1. If that breaks the loading of
 *   the app's modules, the page never hydrates. That is the machine, not the
 *   app: such a page is reloaded and its module-load error is ignored. Any other
 *   failure (an aborted API call included) still fails the test.
 */
function watchContext(context: BrowserContext): () => void {
  const errors: string[] = []
  const hitByNetworkChange = new WeakSet<Page>()
  const reloads = new WeakMap<Page, number>()
  // Top-level document requests in flight, per page.
  const loading = new Map<Page, Set<Request>>()

  const pageLoad = (request: Request) =>
    request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame()

  async function reload(page: Page) {
    // The reload itself can be aborted by the next network change: try again.
    while (!page.isClosed() && (reloads.get(page) ?? 0) < 5) {
      // The test is already loading another page, which replaces the broken one.
      if (loading.get(page)?.size) return
      reloads.set(page, (reloads.get(page) ?? 0) + 1)
      const reloaded = await page.reload().then(
        () => true,
        () => false
      )
      if (reloaded) return
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  context.on('request', request => {
    if (!pageLoad(request)) return
    const page = request.frame().page()
    loading.set(page, (loading.get(page) ?? new Set()).add(request))
  })
  const loaded = (request: Request) => {
    if (pageLoad(request)) loading.get(request.frame().page())?.delete(request)
  }
  context.on('requestfinished', loaded)
  context.on('requestfailed', request => {
    loaded(request)
    if (request.failure()?.errorText === NETWORK_CHANGED) {
      hitByNetworkChange.add(request.frame().page())
    }
  })

  context.on('weberror', webError => {
    const error = webError.error()
    const page = webError.page()
    if (page && hitByNetworkChange.has(page) && MODULE_LOAD_ERROR.test(error.message)) {
      void reload(page)
      return
    }
    errors.push(`${page?.url() ?? ''}\n${error.stack || `${error.name}: ${error.message}`}`)
  })

  return () => {
    if (errors.length > 0) throw new Error(`Uncaught errors in the app:\n\n${errors.join('\n\n')}`)
  }
}

interface Fixtures {
  api: APIRequestContext
  user: TestUser
  loginAs: (user: TestUser) => Promise<Page>
  authedPage: Page
}

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    const assertNoPageErrors = watchContext(context)
    await use(context)
    assertNoPageErrors()
  },

  api: async ({ playwright }, use) => {
    const api = await playwright.request.newContext({ baseURL: BACKEND_URL })
    await use(api)
    await api.dispose()
  },

  user: async ({ api }, use) => {
    await use(await registerUser(api))
  },

  loginAs: async ({ browser }, use) => {
    const opened: { context: BrowserContext; assertNoPageErrors: () => void }[] = []
    await use(async user => {
      // The same thing a real sign-in leaves behind: the session token in localStorage.
      const context = await browser.newContext({
        storageState: {
          cookies: [],
          origins: [
            { origin: FRONTEND_URL, localStorage: [{ name: AUTH_TOKEN_KEY, value: user.token }] },
          ],
        },
      })
      opened.push({ context, assertNoPageErrors: watchContext(context) })
      return context.newPage()
    })
    for (const { context } of opened) await context.close()
    for (const { assertNoPageErrors } of opened) assertNoPageErrors()
  },

  authedPage: async ({ loginAs, user }, use) => {
    await use(await loginAs(user))
  },
})
