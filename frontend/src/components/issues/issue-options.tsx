import { CircleDashed, Hexagon, RefreshCcw } from 'lucide-react'
import { PriorityIcon, PRIORITY_LABELS } from '@/components/PriorityIcon'
import type { PropertyOption } from '@/components/PropertyPicker'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import type { NamedRef } from '@/hooks/useIssueRefs'
import type { IssuePriority } from '@/types/issue'
import type { Label } from '@/types/label'
import type { Team, WorkflowState, WorkflowStateSummary } from '@/types/team'
import type { WorkspaceMember } from '@/types/workspace'

/** Special picker value for "no assignee / project / cycle". */
export const NONE = 'none'

/** Linear's priority menu order. */
export const PRIORITY_MENU: IssuePriority[] = [0, 1, 2, 3, 4]
/** Group / sort order of priorities: urgent first, "no priority" last. */
export const PRIORITY_GROUP_ORDER: IssuePriority[] = [1, 2, 3, 4, 0]

export const ESTIMATES = [0, 1, 2, 3, 5, 8, 13, 21]

/** Fill of a `started` state's icon: the n-th started state of the team fills more. */
export function stateProgress(
  state: WorkflowStateSummary,
  teamStates: readonly WorkflowStateSummary[]
): number {
  if (state.type !== 'started') return 0.5
  const started = teamStates.filter(s => s.type === 'started')
  const index = started.findIndex(s => s.id === state.id)
  if (index < 0 || started.length <= 1) return 0.5
  return (index + 1) / (started.length + 1)
}

export function StateIcon({
  state,
  teamStates = [],
  size,
  label,
}: {
  state: WorkflowStateSummary
  teamStates?: readonly WorkflowStateSummary[]
  size?: number
  label?: string
}) {
  return (
    <StatusIcon
      type={state.type}
      color={state.color}
      progress={stateProgress(state, teamStates)}
      size={size}
      label={label}
    />
  )
}

export function statusOptions(
  states: readonly WorkflowState[],
  teams: readonly Team[] = []
): PropertyOption[] {
  const multiTeam = new Set(states.map(s => s.team_id)).size > 1
  return [...states]
    .sort((a, b) => a.position - b.position)
    .map((state, index) => {
      const team = teams.find(t => t.id === state.team_id)
      return {
        value: state.id,
        label: state.name,
        icon: (
          <StateIcon state={state} teamStates={states.filter(s => s.team_id === state.team_id)} />
        ),
        shortcut: multiTeam ? undefined : String(index + 1),
        group: multiTeam ? team?.name : undefined,
        keywords: [state.type],
      }
    })
}

export function priorityOptions(): PropertyOption[] {
  return PRIORITY_MENU.map(priority => ({
    value: String(priority),
    label: PRIORITY_LABELS[priority],
    icon: <PriorityIcon priority={priority} />,
    shortcut: String(priority),
  }))
}

export function memberName(member: Pick<WorkspaceMember, 'user'>): string {
  return member.user.name || member.user.email
}

export function assigneeOptions(
  members: readonly WorkspaceMember[],
  { noneLabel = 'No assignee', meId }: { noneLabel?: string; meId?: string } = {}
): PropertyOption[] {
  const sorted = [...members].sort((a, b) => {
    if (a.user_id === meId) return -1
    if (b.user_id === meId) return 1
    return memberName(a).localeCompare(memberName(b))
  })
  return [
    { value: NONE, label: noneLabel, icon: <UserAvatar name={null} size="xs" />, shortcut: '0' },
    ...sorted.map(member => ({
      value: member.user_id,
      label: member.user_id === meId ? `${memberName(member)} (you)` : memberName(member),
      icon: <UserAvatar name={memberName(member)} size="xs" />,
      keywords: [member.user.email],
    })),
  ]
}

export function LabelDot({ color }: { color: string }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

export function labelOptions(labels: readonly Label[]): PropertyOption[] {
  return labels.map(label => ({
    value: label.id,
    label: label.name,
    icon: <LabelDot color={label.color} />,
  }))
}

export function ProjectIcon({ color }: { color?: string | null }) {
  return <Hexagon className="size-3.5 shrink-0" style={color ? { color } : undefined} aria-hidden />
}

export function projectOptions(projects: readonly NamedRef[]): PropertyOption[] {
  return [
    {
      value: NONE,
      label: 'No project',
      icon: <CircleDashed className="size-3.5 text-text-tertiary" aria-hidden />,
    },
    ...projects.map(project => ({
      value: project.id,
      label: project.name,
      icon: <ProjectIcon color={project.color} />,
    })),
  ]
}

export function cycleOptions(cycles: readonly NamedRef[]): PropertyOption[] {
  return [
    {
      value: NONE,
      label: 'No cycle',
      icon: <CircleDashed className="size-3.5 text-text-tertiary" aria-hidden />,
    },
    ...cycles.map(cycle => ({
      value: cycle.id,
      label: cycle.name,
      icon: <RefreshCcw className="size-3.5 text-text-secondary" aria-hidden />,
    })),
  ]
}

export function estimateOptions(): PropertyOption[] {
  return [
    { value: NONE, label: 'No estimate' },
    ...ESTIMATES.map(points => ({
      value: String(points),
      label: `${points} ${points === 1 ? 'point' : 'points'}`,
    })),
  ]
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const DATE_FORMAT_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Oct 13" (this year) or "Oct 13, 2025". Accepts `YYYY-MM-DD` and ISO timestamps. */
export function formatShortDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.getFullYear() === new Date().getFullYear()
    ? DATE_FORMAT.format(date)
    : DATE_FORMAT_YEAR.format(date)
}

/** Today as `YYYY-MM-DD` (local time), plus `days`. */
export function isoDate(days = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** True when a due date is before today. */
export function isOverdue(dueDate: string): boolean {
  return dueDate < isoDate()
}
