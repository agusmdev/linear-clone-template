import { CircleDashed } from 'lucide-react'
import type { BoardGroup, GroupedItems } from '@/components/board'
import { PriorityIcon, PRIORITY_LABELS } from '@/components/PriorityIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { priorityRank, type IssueGrouping, type IssueOrdering } from '@/features/issues/view-state'
import type { NamedRef } from '@/hooks/useIssueRefs'
import type { Issue, IssuePriority } from '@/types/issue'
import type { WorkflowState, WorkflowStateType } from '@/types/team'
import type { WorkspaceMember } from '@/types/workspace'
import { memberName, NONE, PRIORITY_GROUP_ORDER, ProjectIcon, StateIcon } from './issue-options'

const TYPE_ORDER: WorkflowStateType[] = ['backlog', 'unstarted', 'started', 'completed', 'canceled']

/** Status group key: states of different teams with the same name and type share a group. */
export function statusKey(state: Pick<WorkflowState, 'type' | 'name'>): string {
  return `${state.type}:${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export interface GroupingInput {
  issues: Issue[]
  grouping: IssueGrouping
  ordering: IssueOrdering
  /** States of the teams on screen. */
  states: WorkflowState[]
  /** State types the view can show (from the tab / "show completed"). */
  stateTypes?: WorkflowStateType[]
  members: WorkspaceMember[]
  projects: NamedRef[]
  meId: string
  /** Board: keep empty status/priority columns. */
  keepEmpty: boolean
}

export interface GroupingResult {
  groups: BoardGroup[]
  items: GroupedItems<Issue>
  groupOf: (issue: Issue) => string
}

function compare(ordering: IssueOrdering) {
  return (a: Issue, b: Issue): number => {
    switch (ordering) {
      case 'priority':
        return priorityRank(a.priority) - priorityRank(b.priority) || a.sort_order - b.sort_order
      case 'created':
        return b.created_at.localeCompare(a.created_at)
      case 'updated':
        return b.updated_at.localeCompare(a.updated_at)
      case 'due_date':
        if (a.due_date === b.due_date) return a.sort_order - b.sort_order
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      default:
        return a.sort_order - b.sort_order
    }
  }
}

/** Splits issues into list groups / board columns, each sorted by the ordering. */
export function groupIssues(input: GroupingInput): GroupingResult {
  const { issues, grouping, states, members, projects, meId, keepEmpty } = input
  const sorted = [...issues].sort(compare(input.ordering))
  let groups: BoardGroup[] = []
  let groupOf: (issue: Issue) => string

  if (grouping === 'status') {
    const seen = new Map<string, WorkflowState>()
    const ordered = [...states].sort(
      (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.position - b.position
    )
    for (const state of ordered) {
      if (input.stateTypes && !input.stateTypes.includes(state.type)) continue
      if (!seen.has(statusKey(state))) seen.set(statusKey(state), state)
    }
    // Issues whose state is not in the list (another team): add their group too.
    for (const issue of sorted) {
      const key = statusKey(issue.state)
      if (!seen.has(key))
        seen.set(key, { ...issue.state, team_id: issue.team_id, position: 999 } as WorkflowState)
    }
    groupOf = issue => statusKey(issue.state)
    groups = [...seen.entries()].map(([key, state]) => ({
      id: key,
      title: state.name,
      icon: (
        <StateIcon state={state} teamStates={states.filter(s => s.team_id === state.team_id)} />
      ),
    }))
  } else if (grouping === 'priority') {
    groupOf = issue => String(issue.priority)
    groups = PRIORITY_GROUP_ORDER.map((priority: IssuePriority) => ({
      id: String(priority),
      title: PRIORITY_LABELS[priority],
      icon: <PriorityIcon priority={priority} />,
    }))
  } else if (grouping === 'assignee') {
    groupOf = issue => issue.assignee_id ?? NONE
    const people = [...members].sort((a, b) => {
      if (a.user_id === meId) return -1
      if (b.user_id === meId) return 1
      return memberName(a).localeCompare(memberName(b))
    })
    groups = [
      ...people.map(member => ({
        id: member.user_id,
        title: memberName(member),
        icon: <UserAvatar name={memberName(member)} size="xs" />,
      })),
      { id: NONE, title: 'No assignee', icon: <UserAvatar name={null} size="xs" /> },
    ]
    // Former members still assigned to issues.
    for (const issue of sorted) {
      if (issue.assignee && !groups.some(g => g.id === issue.assignee_id)) {
        const name = issue.assignee.name || issue.assignee.email
        groups.splice(groups.length - 1, 0, {
          id: issue.assignee.id,
          title: name,
          icon: <UserAvatar name={name} size="xs" />,
        })
      }
    }
  } else if (grouping === 'project') {
    groupOf = issue => issue.project_id ?? NONE
    groups = projects.map(project => ({
      id: project.id,
      title: project.name,
      icon: <ProjectIcon color={project.color} />,
    }))
    for (const issue of sorted) {
      if (issue.project_id && !groups.some(g => g.id === issue.project_id)) {
        groups.push({ id: issue.project_id, title: 'Project', icon: <ProjectIcon /> })
      }
    }
    groups.push({
      id: NONE,
      title: 'No project',
      icon: <CircleDashed className="size-3.5 text-text-tertiary" aria-hidden />,
    })
  } else {
    groupOf = () => 'all'
    groups = [{ id: 'all', title: 'All issues' }]
  }

  const items: Record<string, Issue[]> = Object.fromEntries(groups.map(g => [g.id, []]))
  for (const issue of sorted) {
    const id = groupOf(issue)
    ;(items[id] ??= []).push(issue)
  }
  const keep = keepEmpty
  const visible = keep ? groups : groups.filter(g => (items[g.id]?.length ?? 0) > 0)
  return { groups: visible, items, groupOf }
}

/**
 * The sort order of an issue dropped between two neighbours of its group
 * (manual ordering), or `undefined` to keep its own (an empty group). At the
 * top or bottom of a group, the free side is the closest sort order among the
 * other issues on screen: `first - 1` or `last + 1` would tie with an issue of
 * another group, and in a view without that grouping the tied issues swap.
 */
export function sortOrderBetween(
  before: Issue | undefined,
  after: Issue | undefined,
  others: Issue[]
): number | undefined {
  if (before && after) return (before.sort_order + after.sort_order) / 2
  if (before) {
    const above = before.sort_order
    const next = Math.min(...others.map(i => i.sort_order).filter(order => order > above))
    return Number.isFinite(next) ? (above + next) / 2 : above + 1
  }
  if (after) {
    const below = after.sort_order
    const prev = Math.max(...others.map(i => i.sort_order).filter(order => order < below))
    return Number.isFinite(prev) ? (prev + below) / 2 : below - 1
  }
  return undefined
}
