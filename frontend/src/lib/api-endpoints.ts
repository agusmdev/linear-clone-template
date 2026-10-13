import type { DocumentsParams } from '@/types/document'
import type { IssuesParams } from '@/types/issue'
import type { ItemsParams } from '@/types/item'
import type { SearchParams } from '@/types/search'

export const API = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
  },
  ITEMS: {
    LIST: '/items',
    CREATE: '/items',
    DETAIL: (id: string) => `/items/${id}`,
  },
  USERS: {
    ME: '/users/me',
  },
  WORKSPACES: {
    LIST: '/workspaces',
    CREATE: '/workspaces',
    BY_URL_KEY: (urlKey: string) => `/workspaces/${urlKey}`,
    MEMBERS: (workspaceId: string) => `/workspaces/${workspaceId}/members`,
    TEAMS: (workspaceId: string) => `/workspaces/${workspaceId}/teams`,
    LABELS: (workspaceId: string) => `/workspaces/${workspaceId}/labels`,
  },
  TEAMS: {
    STATES: (teamId: string) => `/teams/${teamId}/states`,
  },
  ISSUES: {
    LIST: '/issues',
    CREATE: '/issues',
    DETAIL: (id: string) => `/issues/${id}`,
    BY_IDENTIFIER: (workspaceId: string, identifier: string) =>
      `/workspaces/${workspaceId}/issues/by-identifier/${identifier}`,
  },
  SEARCH: {
    WORKSPACE: (workspaceId: string) => `/workspaces/${workspaceId}/search`,
  },
  FAVORITES: {
    LIST: (workspaceId: string) => `/workspaces/${workspaceId}/favorites`,
    CREATE: '/favorites',
    DETAIL: (id: string) => `/favorites/${id}`,
  },
  DOCUMENTS: {
    LIST: '/documents',
    CREATE: '/documents',
    DETAIL: (id: string) => `/documents/${id}`,
  },
} as const

/** Makes `%`, `_` and `\` match themselves in an ILIKE pattern (backslash is Postgres' default escape). */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&')
}

/** Builds the items list URL with query string. Translates semantic params to wire keys (e.g. name → name__ilike=%name%). */
export function buildItemsListUrl(params?: ItemsParams): string {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.size) queryParams.append('size', params.size.toString())
  if (params?.name) queryParams.append('name__ilike', `%${escapeLikePattern(params.name)}%`)
  const queryString = queryParams.toString()
  return queryString ? `${API.ITEMS.LIST}?${queryString}` : API.ITEMS.LIST
}

/** Builds the GET /issues URL. Arrays are sent comma-separated; undefined keys are left out. */
export function buildIssuesListUrl(params: IssuesParams): string {
  const queryParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) queryParams.append(key, value.join(','))
    } else {
      queryParams.append(key, String(value))
    }
  }
  return `${API.ISSUES.LIST}?${queryParams.toString()}`
}

/** Builds the GET /workspaces/{id}/search URL (`types` comma-separated). */
export function buildSearchUrl(workspaceId: string, params: SearchParams): string {
  const queryParams = new URLSearchParams({ q: params.q })
  if (params.types?.length) queryParams.append('types', params.types.join(','))
  if (params.limit) queryParams.append('limit', String(params.limit))
  return `${API.SEARCH.WORKSPACE(workspaceId)}?${queryParams.toString()}`
}

/** Builds the GET /documents URL (default order: most recently updated first). */
export function buildDocumentsListUrl(params: DocumentsParams): string {
  const queryParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) queryParams.append(key, value.join(','))
    } else {
      queryParams.append(key, String(value))
    }
  }
  return `${API.DOCUMENTS.LIST}?${queryParams.toString()}`
}
