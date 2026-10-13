import type { TeamSummary } from '@/types/team'
import type { UserSummary } from '@/types/user'

export type ProjectStatus = 'planned' | 'started' | 'paused' | 'completed' | 'canceled'

/** Issue progress of a project. Canceled and archived issues are not counted. */
export interface ProjectProgress {
  total: number
  completed: number
  /** 0-100, rounded down. */
  percentage: number
}

/** GET /projects/{id}, GET /workspaces/{id}/projects (see docs/API.md). */
export interface Project {
  id: string
  workspace_id: string
  name: string
  /** HTML from the TipTap editor. */
  description: string | null
  status: ProjectStatus
  lead_id: string | null
  lead: UserSummary | null
  /** `YYYY-MM-DD`. */
  start_date: string | null
  /** `YYYY-MM-DD`. */
  target_date: string | null
  color: string | null
  icon: string | null
  sort_order: number
  team_ids: string[]
  /** By name. */
  teams: TeamSummary[]
  /** Issues of the project that are not archived or canceled. */
  issue_count: number
  /** Of those, issues in a "completed" state. */
  completed_issue_count: number
  progress: ProjectProgress
  created_at: string
  updated_at: string
}

/** Query of GET /workspaces/{id}/projects. */
export interface ProjectsParams {
  status?: ProjectStatus
  team_id?: string
}

export interface CreateProjectData {
  workspace_id: string
  name: string
  description?: string | null
  status?: ProjectStatus
  lead_id?: string | null
  start_date?: string | null
  target_date?: string | null
  color?: string | null
  icon?: string | null
  team_ids?: string[]
}

/** PATCH /projects/{id}: only the sent keys change; `team_ids` replaces the teams. */
export type UpdateProjectData = Partial<Omit<CreateProjectData, 'workspace_id'>> & {
  sort_order?: number
}
