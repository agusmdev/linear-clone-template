/**
 * Projects and cycles for the issue pickers, filters and groups.
 *
 * The projects and cycles APIs (GET /workspaces/{id}/projects, GET
 * /teams/{id}/cycles) belong to other feature slices. Until they are merged,
 * these hooks return no rows: the pickers show "No project" / "No cycle" only.
 * Integration: return the real lists here (same `IssueRef` shape).
 */

export interface NamedRef {
  id: string
  name: string
  color?: string | null
  /** Cycles: the team of the cycle. */
  team_id?: string
}

const NONE: NamedRef[] = []

export function useProjectRefs(workspaceId: string | undefined): NamedRef[] {
  void workspaceId
  return NONE
}

export function useCycleRefs(teamIds: string[]): NamedRef[] {
  void teamIds
  return NONE
}
