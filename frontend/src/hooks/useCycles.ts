import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API, buildIssuesListUrl } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type {
  CompleteCycleData,
  CompleteCycleResult,
  CreateCycleData,
  Cycle,
  UpdateCycleData,
} from '@/types/cycle'
import type { Issue, IssuesParams } from '@/types/issue'
import type { Page } from '@/types/page'

/** The cycles of a team, by start date (GET /teams/{id}/cycles). */
export function useTeamCycles(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cycles.list(teamId ?? ''),
    queryFn: () => api.get<Cycle[]>(API.CYCLES.TEAM(teamId ?? '')),
    enabled: !!teamId,
  })
}

export function useCycle(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.cycles.detail(cycleId),
    queryFn: () => api.get<Cycle>(API.CYCLES.DETAIL(cycleId)),
    retry: false,
  })
}

/** Issues of a cycle (GET /issues?cycle_id=…). Shares the issues cache keys. */
export function useCycleIssues(params: IssuesParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.issues.list(params),
    queryFn: () => api.get<Page<Issue>>(buildIssuesListUrl(params)),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useCreateCycle(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCycleData) => api.post<Cycle>(API.CYCLES.TEAM(teamId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all })
    },
  })
}

export function useUpdateCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cycleId, data }: { cycleId: string; data: UpdateCycleData }) =>
      api.patch<Cycle>(API.CYCLES.DETAIL(cycleId), data),
    onSuccess: cycle => {
      queryClient.setQueryData(queryKeys.cycles.detail(cycle.id), cycle)
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all })
    },
  })
}

export function useDeleteCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cycleId: string) => api.delete(API.CYCLES.DETAIL(cycleId)),
    onSuccess: (_data, cycleId) => {
      queryClient.removeQueries({ queryKey: queryKeys.cycles.detail(cycleId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all })
      // The issues of the cycle lose their cycle_id.
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}

/** Moves the unfinished issues of a cycle to the next (or the given) cycle. */
export function useCompleteCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cycleId, data }: { cycleId: string; data?: CompleteCycleData }) =>
      api.post<CompleteCycleResult>(API.CYCLES.COMPLETE(cycleId), data ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}
