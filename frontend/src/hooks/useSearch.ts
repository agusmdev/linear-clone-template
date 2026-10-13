import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { buildSearchUrl } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import { SEARCH_QUERY_MAX_LENGTH, type SearchParams, type SearchResults } from '@/types/search'

/**
 * Workspace search (GET /workspaces/{id}/search). Disabled while the query is blank.
 * A pasted query longer than the API accepts searches its first characters.
 */
export function useSearch(workspaceId: string, params: SearchParams) {
  const q = params.q.trim().slice(0, SEARCH_QUERY_MAX_LENGTH).trim()
  const normalized: SearchParams = { ...params, q }
  return useQuery({
    queryKey: queryKeys.search.results(workspaceId, normalized),
    queryFn: () => api.get<SearchResults>(buildSearchUrl(workspaceId, normalized)),
    enabled: q.length > 0,
    // Keep the last results on screen while the next query loads.
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}
