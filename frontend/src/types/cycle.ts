import type { WorkflowStateType } from '@/types/team'

export type CycleStatus = 'current' | 'upcoming' | 'past'

/** Non-archived issues of the cycle, by workflow state type. */
export type CycleScope = Record<WorkflowStateType, number>

export interface CycleProgress {
  /** Scope without canceled issues (= `issue_count`). */
  total: number
  completed: number
  /** round(completed * 100 / total); 0 when the cycle has no issues. */
  percentage: number
  scope: CycleScope
}

/** GET /teams/{team_id}/cycles, GET /cycles/{cycle_id} (see docs/API.md, CYC-1). */
export interface Cycle {
  id: string
  team_id: string
  /** Auto-incremented per team: "Cycle 3". */
  number: number
  name: string | null
  /** `YYYY-MM-DD`, inclusive. */
  starts_at: string
  /** `YYYY-MM-DD`, inclusive. */
  ends_at: string
  /** From today's date (UTC): current (starts_at <= today <= ends_at), upcoming, past. */
  status: CycleStatus
  issue_count: number
  completed_issue_count: number
  progress: CycleProgress
  created_at: string
  updated_at: string
}

export interface CreateCycleData {
  name?: string | null
  starts_at: string
  ends_at: string
}

export type UpdateCycleData = Partial<CreateCycleData>

/** POST /cycles/{id}/complete. Default target: the team's next cycle. */
export interface CompleteCycleData {
  target_cycle_id?: string | null
}

export interface CompleteCycleResult {
  moved: number
  target_cycle: Cycle
}
