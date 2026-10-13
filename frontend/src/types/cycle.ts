/** Planned: /cycles endpoints (see docs/API.md). */
export interface Cycle {
  id: string
  team_id: string
  number: number
  name: string | null
  /** `YYYY-MM-DD`. */
  starts_at: string
  ends_at: string
  /** From today's date: current (starts_at <= today <= ends_at), upcoming, past. */
  status: 'current' | 'upcoming' | 'past'
  issue_count: number
  completed_issue_count: number
  created_at: string
  updated_at: string
}

export interface CreateCycleData {
  name?: string | null
  starts_at: string
  ends_at: string
}

export type UpdateCycleData = Partial<CreateCycleData>
