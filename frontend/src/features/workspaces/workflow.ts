import type { WorkflowState, WorkflowStateType } from '@/types/team'

/** Linear's workflow categories, in board order. */
export const STATE_TYPE_ORDER: WorkflowStateType[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]

export const STATE_TYPE_LABELS: Record<WorkflowStateType, string> = {
  backlog: 'Backlog',
  unstarted: 'Unstarted',
  started: 'Started',
  completed: 'Completed',
  canceled: 'Canceled',
}

/** Default color of a new state per category (the colors of the default workflow). */
export const STATE_TYPE_COLORS: Record<WorkflowStateType, string> = {
  backlog: '#bec2c8',
  unstarted: '#e2e2e2',
  started: '#f2c94c',
  completed: '#5e6ad2',
  canceled: '#95a2b3',
}

const typeRank = (type: WorkflowStateType) => STATE_TYPE_ORDER.indexOf(type)

/** States sorted as settings and boards show them: by category, then position. */
export function sortStates(states: WorkflowState[]): WorkflowState[] {
  return [...states].sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.position - b.position)
}

/**
 * A position that puts a new state of `type` at the end of its category: after
 * every state of the same or an earlier category, before the later ones.
 */
export function positionForNewState(states: WorkflowState[], type: WorkflowStateType): number {
  const rank = typeRank(type)
  const before = states.filter(s => typeRank(s.type) <= rank).map(s => s.position)
  const after = states.filter(s => typeRank(s.type) > rank).map(s => s.position)
  const low = before.length ? Math.max(...before) : null
  const high = after.length ? Math.min(...after) : null
  if (low === null && high === null) return 0
  if (low === null) return (high as number) - 1
  if (high === null || high <= low) return low + 1
  return (low + high) / 2
}
