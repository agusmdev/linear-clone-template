import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API, buildIssuesListUrl } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type {
  BulkDeleteIssuesData,
  BulkUpdateIssuesData,
  BulkUpdateIssuesResponse,
  CreateIssueData,
  Issue,
  IssuesParams,
  UpdateIssueData,
} from '@/types/issue'
import type { Page } from '@/types/page'
import type { Team, WorkflowState } from '@/types/team'

const PAGE_SIZE = 100
/** Safety cap: 20 pages of 100 issues. */
const MAX_PAGES = 20

/** Every page of GET /issues for `params`, flattened. */
async function fetchAllIssues(params: IssuesParams): Promise<Issue[]> {
  const items: Issue[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await api.get<Page<Issue>>(
      buildIssuesListUrl({ ...params, page, size: PAGE_SIZE })
    )
    items.push(...result.items)
    if (page >= result.pages) break
  }
  return items
}

/** All issues that match `params` (every page). Used by IssuesView. */
export function useIssueList(params: IssuesParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.issues.listAll(params),
    queryFn: () => fetchAllIssues(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/** One page of GET /issues (pickers, small lists). */
export function useIssuesPage(params: IssuesParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.issues.list(params),
    queryFn: () => api.get<Page<Issue>>(buildIssuesListUrl(params)),
    enabled,
    placeholderData: keepPreviousData,
  })
}

function combineStates(results: UseQueryResult<WorkflowState[]>[]) {
  return {
    data: results.flatMap(result => result.data ?? []),
    isLoading: results.some(result => result.isLoading),
  }
}

/** The workflow states of every given team (cached per team, same key as useTeamStates). */
export function useWorkspaceStates(teams: Team[]) {
  return useQueries({
    queries: teams.map(team => ({
      queryKey: queryKeys.teams.states(team.id),
      queryFn: () => api.get<WorkflowState[]>(API.TEAMS.STATES(team.id)),
    })),
    combine: combineStates,
  })
}

// --- optimistic cache helpers ---------------------------------------------------

type IssueMapper = (issue: Issue) => Issue | null

function isIssue(value: unknown): value is Issue {
  return !!value && typeof value === 'object' && 'identifier' in value && 'state_id' in value
}

/** Applies `map` to every cached issue (lists, pages and details). `null` removes it. */
function mapCachedData(old: unknown, map: IssueMapper): unknown {
  const mapList = (list: unknown[]) =>
    list.flatMap(item => {
      if (!isIssue(item)) return [item]
      const next = map(item)
      return next ? [next] : []
    })
  if (Array.isArray(old)) return mapList(old)
  if (old && typeof old === 'object' && 'items' in old && Array.isArray(old.items)) {
    const items = mapList(old.items)
    const removed = old.items.length - items.length
    return { ...old, items, total: (old as Page<Issue>).total - removed }
  }
  if (isIssue(old)) return map(old) ?? old
  return old
}

async function patchCache(queryClient: QueryClient, map: IssueMapper) {
  await queryClient.cancelQueries({ queryKey: queryKeys.issues.all })
  const snapshot = queryClient.getQueriesData({ queryKey: queryKeys.issues.all })
  queryClient.setQueriesData({ queryKey: queryKeys.issues.all }, old => mapCachedData(old, map))
  return snapshot
}

function restore(queryClient: QueryClient, snapshot: [readonly unknown[], unknown][] | undefined) {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data)
}

// --- mutations ----------------------------------------------------------------

/**
 * Refreshes every cache an issue change can touch: issue lists and details,
 * the project and cycle progress counts, the sidebar favorites and search results.
 */
export function invalidateIssueCaches(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all }),
    // Sidebar favorites show the issue title and drop deleted issues.
    queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all }),
    // Cmd+K and the search page: a new, renamed or deleted issue (cached 10 s).
    queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
  ])
}

export function useCreateIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateIssueData) => api.post<Issue>(API.ISSUES.CREATE, data),
    onSuccess: () => invalidateIssueCaches(queryClient),
  })
}

export interface UpdateIssueVariables {
  id: string
  data: UpdateIssueData
  /** Fields to show at once (e.g. the new `state` object), before the server answers. */
  optimistic?: Partial<Issue>
}

/** PATCH /issues/{id} with an optimistic update of every cached list. */
export function useUpdateIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: UpdateIssueVariables) =>
      api.patch<Issue>(API.ISSUES.DETAIL(id), data),
    onMutate: ({ id, data, optimistic }) =>
      patchCache(queryClient, issue =>
        issue.id === id ? ({ ...issue, ...data, ...optimistic } as Issue) : issue
      ),
    onError: (_error, _vars, snapshot) => restore(queryClient, snapshot),
    onSettled: () => invalidateIssueCaches(queryClient),
  })
}

/** Max issue ids of one bulk request (BULK_MAX of the API). */
const BULK_MAX = 250

/** Splits `ids` into lists the bulk endpoints accept (a selection can hold every issue of a view). */
function bulkChunks(ids: string[]): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += BULK_MAX) chunks.push(ids.slice(i, i + BULK_MAX))
  return chunks
}

export interface BulkUpdateVariables {
  data: BulkUpdateIssuesData
  /** The optimistic version of one issue. */
  optimistic?: (issue: Issue) => Issue
}

export function useBulkUpdateIssues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ data }: BulkUpdateVariables): Promise<BulkUpdateIssuesResponse> => {
      const items: Issue[] = []
      for (const issueIds of bulkChunks(data.issue_ids)) {
        const result = await api.post<BulkUpdateIssuesResponse>(API.ISSUES.BULK_UPDATE, {
          ...data,
          issue_ids: issueIds,
        })
        items.push(...result.items)
      }
      return { items }
    },
    onMutate: ({ data, optimistic }) => {
      const ids = new Set(data.issue_ids)
      return patchCache(queryClient, issue =>
        ids.has(issue.id) && optimistic ? optimistic(issue) : issue
      )
    },
    onError: (_error, _vars, snapshot) => restore(queryClient, snapshot),
    onSettled: () => invalidateIssueCaches(queryClient),
  })
}

export function useBulkDeleteIssues() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: BulkDeleteIssuesData) => {
      for (const issueIds of bulkChunks(data.issue_ids))
        await api.postNoContent(API.ISSUES.BULK_DELETE, { issue_ids: issueIds })
    },
    onMutate: ({ issue_ids }) => {
      const ids = new Set(issue_ids)
      return patchCache(queryClient, issue => (ids.has(issue.id) ? null : issue))
    },
    onError: (_error, _vars, snapshot) => restore(queryClient, snapshot),
    onSettled: () => invalidateIssueCaches(queryClient),
  })
}
