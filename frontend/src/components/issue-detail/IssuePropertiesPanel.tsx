import * as React from 'react'
import { Box, CalendarDays, Plus, RefreshCcw, Triangle, X } from 'lucide-react'
import { PriorityIcon, PRIORITY_LABELS, PRIORITY_ORDER } from '@/components/PriorityIcon'
import { PropertyPicker, type PropertyOption } from '@/components/PropertyPicker'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { formatDueDate } from '@/lib/relative-time'
import { cn } from '@/lib/utils'
import type { Cycle } from '@/types/cycle'
import type { Project } from '@/types/project'
import type { Issue, IssuePriority, UpdateIssueData } from '@/types/issue'
import type { Label } from '@/types/label'
import type { WorkflowState } from '@/types/team'
import type { WorkspaceMember } from '@/types/workspace'

const NONE = 'none'

/** Pickers of the panel that a keyboard shortcut can open. */
export type PanelPicker = 'status' | 'priority' | 'assignee' | 'labels'
const CYCLE_GROUPS = { current: 'Current', upcoming: 'Upcoming', past: 'Past' } as const

/** "Sprint 4" or "Cycle 3". */
export function cycleLabel(cycle: Pick<Cycle, 'name' | 'number'>): string {
  return cycle.name || `Cycle ${cycle.number}`
}
const ESTIMATES = [1, 2, 3, 5, 8, 13, 21]

interface IssuePropertiesPanelProps {
  issue: Issue
  states: WorkflowState[]
  members: WorkspaceMember[]
  labels: Label[]
  /** Display name of the issue's project / cycle (read-only rows); null = none. */
  projectName: string | null
  cycleName: string | null
  /** The team's cycles; without them the cycle row is read-only. */
  cycles?: Cycle[]
  /** The workspace's projects; without them the project row is read-only. */
  projects?: Project[]
  /** The open picker (keyboard shortcuts S, P, A, L open them). */
  openPicker: PanelPicker | null
  onOpenPickerChange: (picker: PanelPicker | null) => void
  onUpdate: (data: UpdateIssueData) => void
  className?: string
}

const valueButtonClass =
  'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-ui text-foreground transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none data-[state=open]:bg-surface-active'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-1">
      <span className="w-[90px] shrink-0 text-mini text-text-secondary">{label}</span>
      {children}
    </div>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="truncate text-text-tertiary">{children}</span>
}

/** Right panel of the issue page: one row per property, each opens a searchable picker. */
export function IssuePropertiesPanel({
  issue,
  states,
  members,
  labels,
  projectName,
  cycleName,
  cycles,
  projects,
  openPicker,
  onOpenPickerChange,
  onUpdate,
  className,
}: IssuePropertiesPanelProps) {
  const sortedStates = [...states].sort((a, b) => a.position - b.position)
  const stateOptions: PropertyOption[] = sortedStates.map((state, index) => ({
    value: state.id,
    label: state.name,
    icon: <StatusIcon type={state.type} color={state.color} />,
    shortcut: index < 9 ? String(index + 1) : undefined,
  }))
  const priorityOptions: PropertyOption[] = PRIORITY_ORDER.map(priority => ({
    value: String(priority),
    label: PRIORITY_LABELS[priority],
    icon: <PriorityIcon priority={priority} />,
    shortcut: String(priority),
  }))
  const assigneeOptions: PropertyOption[] = [
    { value: NONE, label: 'No assignee', icon: <UserAvatar name={null} size="xs" /> },
    ...members.map(member => ({
      value: member.user_id,
      label: member.user.name || member.user.email,
      keywords: [member.user.email],
      icon: <UserAvatar name={member.user.name || member.user.email} size="xs" />,
    })),
  ]
  const labelOptions: PropertyOption[] = labels.map(label => ({
    value: label.id,
    label: label.name,
    icon: <span className="size-2.5 rounded-full" style={{ backgroundColor: label.color }} />,
  }))
  const estimateOptions: PropertyOption[] = [
    { value: NONE, label: 'No estimate' },
    ...ESTIMATES.map(points => ({
      value: String(points),
      label: `${points} ${points === 1 ? 'point' : 'points'}`,
    })),
  ]
  const cycleOptions: PropertyOption[] = [
    { value: NONE, label: 'No cycle' },
    // Past cycles are closed: only the issue's own cycle stays in the list.
    ...(cycles ?? [])
      .filter(cycle => cycle.status !== 'past' || cycle.id === issue.cycle_id)
      .map(cycle => ({
        value: cycle.id,
        label: cycleLabel(cycle),
        keywords: [`Cycle ${cycle.number}`],
        group: CYCLE_GROUPS[cycle.status],
      })),
  ]
  const projectOptions: PropertyOption[] = [
    { value: NONE, label: 'No project', icon: <Box className="size-3.5 text-text-tertiary" /> },
    ...(projects ?? []).map(project => ({
      value: project.id,
      label: project.name,
      icon: (
        <Box
          className="size-3.5"
          style={project.color ? { color: project.color } : undefined}
          aria-hidden
        />
      ),
    })),
  ]
  const assigneeName = issue.assignee ? issue.assignee.name || issue.assignee.email : null

  return (
    <aside aria-label="Issue properties" className={cn('flex flex-col gap-0.5', className)}>
      <Row label="Status">
        <PropertyPicker
          label="Status"
          open={openPicker === 'status'}
          onOpenChange={open => onOpenPickerChange(open ? 'status' : null)}
          placeholder="Change status..."
          options={stateOptions}
          value={issue.state_id}
          onChange={stateId => onUpdate({ state_id: stateId })}
          trigger={
            <button type="button" aria-label="Change status" className={valueButtonClass}>
              <StatusIcon type={issue.state.type} color={issue.state.color} />
              <span className="truncate">{issue.state.name}</span>
            </button>
          }
        />
      </Row>

      <Row label="Priority">
        <PropertyPicker
          label="Priority"
          open={openPicker === 'priority'}
          onOpenChange={open => onOpenPickerChange(open ? 'priority' : null)}
          placeholder="Set priority to..."
          options={priorityOptions}
          value={String(issue.priority)}
          onChange={value => onUpdate({ priority: Number(value) as IssuePriority })}
          trigger={
            <button type="button" aria-label="Change priority" className={valueButtonClass}>
              <PriorityIcon priority={issue.priority} />
              {issue.priority === 0 ? (
                <Placeholder>Set priority</Placeholder>
              ) : (
                <span className="truncate">{PRIORITY_LABELS[issue.priority]}</span>
              )}
            </button>
          }
        />
      </Row>

      <Row label="Assignee">
        <PropertyPicker
          label="Assignee"
          open={openPicker === 'assignee'}
          onOpenChange={open => onOpenPickerChange(open ? 'assignee' : null)}
          placeholder="Assign to..."
          options={assigneeOptions}
          value={issue.assignee_id ?? NONE}
          onChange={value => onUpdate({ assignee_id: value === NONE ? null : value })}
          trigger={
            <button type="button" aria-label="Change assignee" className={valueButtonClass}>
              <UserAvatar name={assigneeName} size="xs" />
              {assigneeName ? (
                <span className="truncate">{assigneeName}</span>
              ) : (
                <Placeholder>Assign</Placeholder>
              )}
            </button>
          }
        />
      </Row>

      <Row label="Labels">
        <PropertyPicker
          multiple
          label="Labels"
          open={openPicker === 'labels'}
          onOpenChange={open => onOpenPickerChange(open ? 'labels' : null)}
          placeholder="Change labels..."
          options={labelOptions}
          value={issue.labels.map(label => label.id)}
          onChange={labelIds => onUpdate({ label_ids: labelIds })}
          trigger={
            <button
              type="button"
              aria-label="Change labels"
              className={cn(valueButtonClass, 'h-auto min-h-8 flex-wrap py-1')}
            >
              {issue.labels.length === 0 ? (
                <>
                  <Plus className="size-3.5 text-text-tertiary" />
                  <Placeholder>Add label</Placeholder>
                </>
              ) : (
                issue.labels.map(label => (
                  <span
                    key={label.id}
                    className="inline-flex h-5 items-center gap-1.5 rounded-full border border-border px-2 text-mini"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </span>
                ))
              )}
            </button>
          }
        />
      </Row>

      <Row label="Cycle">
        {cycles ? (
          <PropertyPicker
            label="Cycle"
            placeholder="Add to cycle..."
            options={cycleOptions}
            value={issue.cycle_id ?? NONE}
            onChange={value => onUpdate({ cycle_id: value === NONE ? null : value })}
            trigger={
              <button type="button" aria-label="Change cycle" className={valueButtonClass}>
                <RefreshCcw className="size-3.5 text-text-secondary" />
                {cycleName ? (
                  <span className="truncate">{cycleName}</span>
                ) : (
                  <Placeholder>Add to cycle</Placeholder>
                )}
              </button>
            }
          />
        ) : (
          <span className={cn(valueButtonClass, 'cursor-default hover:bg-transparent')}>
            <RefreshCcw className="size-3.5 text-text-secondary" />
            {cycleName ? (
              <span className="truncate">{cycleName}</span>
            ) : (
              <Placeholder>No cycle</Placeholder>
            )}
          </span>
        )}
      </Row>

      <Row label="Project">
        {projects ? (
          <PropertyPicker
            label="Project"
            placeholder="Add to project..."
            options={projectOptions}
            value={issue.project_id ?? NONE}
            onChange={value => onUpdate({ project_id: value === NONE ? null : value })}
            trigger={
              <button type="button" aria-label="Change project" className={valueButtonClass}>
                <Box className="size-3.5 text-text-secondary" />
                {projectName ? (
                  <span className="truncate">{projectName}</span>
                ) : (
                  <Placeholder>Add to project</Placeholder>
                )}
              </button>
            }
          />
        ) : (
          <span className={cn(valueButtonClass, 'cursor-default hover:bg-transparent')}>
            <Box className="size-3.5 text-text-secondary" />
            {projectName ? (
              <span className="truncate">{projectName}</span>
            ) : (
              <Placeholder>No project</Placeholder>
            )}
          </span>
        )}
      </Row>

      <Row label="Estimate">
        <PropertyPicker
          label="Estimate"
          placeholder="Set estimate..."
          options={estimateOptions}
          value={issue.estimate === null ? NONE : String(issue.estimate)}
          onChange={value => onUpdate({ estimate: value === NONE ? null : Number(value) })}
          trigger={
            <button type="button" aria-label="Change estimate" className={valueButtonClass}>
              <Triangle className="size-3.5 text-text-secondary" />
              {issue.estimate === null ? (
                <Placeholder>Set estimate</Placeholder>
              ) : (
                <span className="truncate">
                  {issue.estimate} {issue.estimate === 1 ? 'point' : 'points'}
                </span>
              )}
            </button>
          }
        />
      </Row>

      <Row label="Due date">
        <DueDateField
          value={issue.due_date}
          onChange={dueDate => onUpdate({ due_date: dueDate })}
        />
      </Row>
    </aside>
  )
}

function DueDateField({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  return (
    <div className="group relative flex min-w-0 flex-1 items-center">
      <label className={cn(valueButtonClass, 'relative cursor-pointer')}>
        <CalendarDays className="size-3.5 text-text-secondary" />
        {value ? (
          <span className="truncate">{formatDueDate(value)}</span>
        ) : (
          <Placeholder>Set due date</Placeholder>
        )}
        <input
          ref={inputRef}
          type="date"
          aria-label="Due date"
          value={value ?? ''}
          onClick={() => {
            try {
              inputRef.current?.showPicker?.()
            } catch {
              // Not allowed here (e.g. in a cross-origin frame): the native control still works.
            }
          }}
          onChange={event => {
            const next = event.target.value || null
            if (next !== value) onChange(next)
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      {value ? (
        <button
          type="button"
          aria-label="Remove due date"
          onClick={() => onChange(null)}
          className="absolute right-1 flex size-6 items-center justify-center rounded text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-surface-active hover:text-foreground focus-visible:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
