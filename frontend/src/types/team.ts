import type { UserSummary } from '@/types/user'

export interface TeamSummary {
  id: string
  key: string
  name: string
}

export interface Team extends TeamSummary {
  workspace_id: string
  description: string | null
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
}

/** POST /workspaces/{id}/teams, PATCH /teams/{id}. */
export interface CreateTeamData {
  name: string
  /** 2-5 uppercase letters, unique in the workspace. */
  key: string
  description?: string | null
  color?: string | null
  icon?: string | null
}

export type UpdateTeamData = Partial<CreateTeamData>

/** GET /teams/{id}/members. */
export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  created_at: string
  user: UserSummary
}

export type WorkflowStateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'

export interface WorkflowStateSummary {
  id: string
  name: string
  type: WorkflowStateType
  color: string
}

export interface WorkflowState extends WorkflowStateSummary {
  team_id: string
  /** Board/list order (ascending). */
  position: number
  created_at: string
  updated_at: string
}

/** POST /teams/{id}/states, PATCH /workflow-states/{id}. */
export interface CreateWorkflowStateData {
  name: string
  type: WorkflowStateType
  color: string
  position?: number
}

export type UpdateWorkflowStateData = Partial<CreateWorkflowStateData>
