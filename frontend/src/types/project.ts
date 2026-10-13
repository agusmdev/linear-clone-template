import type { UserSummary } from '@/types/user'

export type ProjectStatus = 'planned' | 'started' | 'paused' | 'completed' | 'canceled'

/** Planned: /projects endpoints (see docs/API.md). */
export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: ProjectStatus
  lead_id: string | null
  lead: UserSummary | null
  start_date: string | null
  target_date: string | null
  color: string | null
  icon: string | null
  sort_order: number
  team_ids: string[]
  /** Not archived issues of the project. */
  issue_count: number
  /** Of those, issues in a "completed" state. */
  completed_issue_count: number
  created_at: string
  updated_at: string
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

export type UpdateProjectData = Partial<Omit<CreateProjectData, 'workspace_id'>> & {
  sort_order?: number
}
