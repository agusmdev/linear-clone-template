import { useQueries } from '@tanstack/react-query'
import { fetchTeamCycles } from '@/hooks/useCycles'
import { useProjects } from '@/hooks/useProjects'
import { queryKeys } from '@/lib/query-keys'
import type { Cycle } from '@/types/cycle'

/** A project or cycle as the issue pickers, filters and groups show it. */
export interface NamedRef {
  id: string
  name: string
  color?: string | null
  /** Cycles: the team of the cycle. */
  team_id?: string
  /** Cycles: past cycles are left out of the pickers. */
  past?: boolean
}

const NONE: NamedRef[] = []

/** The workspace's projects (same cache as `useProjects`). */
export function useProjectRefs(workspaceId: string): NamedRef[] {
  const { data } = useProjects(workspaceId)
  if (!data) return NONE
  return data.map(project => ({ id: project.id, name: project.name, color: project.color }))
}

function cycleRef(cycle: Cycle): NamedRef {
  return {
    id: cycle.id,
    name: cycle.name || `Cycle ${cycle.number}`,
    team_id: cycle.team_id,
    past: cycle.status === 'past',
  }
}

/** The cycles of the given teams (same cache as `useTeamCycles`). */
export function useCycleRefs(teamIds: string[]): NamedRef[] {
  return useQueries({
    queries: teamIds.map(teamId => ({
      queryKey: queryKeys.cycles.list(teamId),
      queryFn: () => fetchTeamCycles(teamId),
    })),
    combine: results => results.flatMap(result => (result.data ?? []).map(cycleRef)),
  })
}
