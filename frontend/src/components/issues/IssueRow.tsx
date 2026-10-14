import { CalendarClock } from 'lucide-react'
import { PriorityIcon, PRIORITY_LABELS } from '@/components/PriorityIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import type { Issue } from '@/types/issue'
import { IssueContextMenu } from './IssueContextMenu'
import { IssuePicker, useIssueView } from './IssuePickers'
import { formatShortDate, isOverdue, LabelDot, ProjectIcon, StateIcon } from './issue-options'

const pickerButton =
  'flex shrink-0 items-center justify-center rounded-md outline-none hover:bg-surface-active focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:bg-surface-active'

/** Labels a list row shows one by one; more collapse into one "N labels" chip. */
const MAX_ROW_LABELS = 2

const labelChip =
  'inline-flex h-5 max-w-40 min-w-0 items-center gap-1.5 rounded-full border border-border px-2 text-micro whitespace-nowrap text-text-secondary hover:bg-surface-hover'

/** One issue in the list layout (Linear's row anatomy). */
export function IssueRow({ issue }: { issue: Issue }) {
  const view = useIssueView()
  const teamStates = view.states.filter(s => s.team_id === issue.team_id)
  const project = issue.project_id ? view.projects.find(p => p.id === issue.project_id) : undefined
  const completed = issue.state.type === 'completed' || issue.state.type === 'canceled'

  return (
    <IssueContextMenu issue={issue}>
      <div
        className="flex h-full min-w-0 flex-1 items-center gap-2"
        data-issue-row={issue.identifier}
      >
        <IssuePicker
          issue={issue}
          kind="priority"
          trigger={
            <button
              type="button"
              aria-label={`Priority: ${PRIORITY_LABELS[issue.priority]}`}
              className={cn(pickerButton, 'size-6')}
            >
              <PriorityIcon priority={issue.priority} />
            </button>
          }
        />
        <span className="hidden min-w-16 shrink-0 text-ui whitespace-nowrap text-text-tertiary tabular-nums sm:block">
          {issue.identifier}
        </span>
        <IssuePicker
          issue={issue}
          kind="status"
          trigger={
            <button
              type="button"
              aria-label={`Status: ${issue.state.name}`}
              className={cn(pickerButton, 'size-6')}
            >
              <StateIcon state={issue.state} teamStates={teamStates} />
            </button>
          }
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-ui text-foreground',
            completed && 'text-text-secondary'
          )}
        >
          {issue.title}
        </span>
        <IssuePicker
          issue={issue}
          kind="labels"
          align="end"
          trigger={
            issue.labels.length > 0 ? (
              <button
                type="button"
                aria-label={`Labels: ${issue.labels.map(l => l.name).join(', ')}`}
                className="hidden max-w-64 min-w-0 shrink items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:flex"
              >
                {/* Like Linear: more than two labels collapse into one "N labels" chip,
                    so no chip is cut off and no label is hidden without a hint. */}
                {issue.labels.length > MAX_ROW_LABELS ? (
                  <span className={labelChip}>
                    <span className="flex shrink-0 -space-x-0.5">
                      {issue.labels.slice(0, 3).map(label => (
                        <LabelDot key={label.id} color={label.color} />
                      ))}
                    </span>
                    {issue.labels.length} labels
                  </span>
                ) : (
                  issue.labels.map(label => (
                    <span key={label.id} title={label.name} className={labelChip}>
                      <LabelDot color={label.color} />
                      <span className="truncate">{label.name}</span>
                    </span>
                  ))
                )}
              </button>
            ) : (
              // No labels to show: an empty anchor, so L still opens the picker here.
              <button
                type="button"
                aria-label="Labels: none"
                tabIndex={-1}
                className="-ml-2 size-0 shrink-0 overflow-hidden outline-none"
              />
            )
          }
        />
        {project ? (
          <span
            title={project.name}
            className="hidden h-5 max-w-48 shrink-0 items-center gap-1 rounded-full border border-border px-2 text-micro text-text-secondary lg:inline-flex"
          >
            <ProjectIcon color={project.color} />
            <span className="truncate">{project.name}</span>
          </span>
        ) : null}
        {issue.due_date ? (
          <span
            title={`Due ${issue.due_date}`}
            className={cn(
              'hidden h-5 shrink-0 items-center gap-1 rounded-full border border-border px-2 text-micro text-text-secondary md:inline-flex',
              !completed && isOverdue(issue.due_date) && 'border-destructive/40 text-destructive'
            )}
          >
            <CalendarClock className="size-3" aria-hidden />
            {formatShortDate(issue.due_date)}
          </span>
        ) : null}
        <span className="hidden w-14 shrink-0 text-right text-mini text-text-tertiary md:block">
          {formatShortDate(issue.created_at)}
        </span>
        <IssuePicker
          issue={issue}
          kind="assignee"
          align="end"
          trigger={
            <button
              type="button"
              aria-label={`Assignee: ${issue.assignee?.name || issue.assignee?.email || 'Unassigned'}`}
              className={cn(pickerButton, 'size-6 rounded-full')}
            >
              <UserAvatar
                name={issue.assignee ? issue.assignee.name || issue.assignee.email : null}
                size="sm"
              />
            </button>
          }
        />
      </div>
    </IssueContextMenu>
  )
}

/** One issue on the board layout. */
export function IssueCard({ issue, onOpen }: { issue: Issue; onOpen: (issue: Issue) => void }) {
  const view = useIssueView()
  const teamStates = view.states.filter(s => s.team_id === issue.team_id)
  const completed = issue.state.type === 'completed' || issue.state.type === 'canceled'

  return (
    <IssueContextMenu issue={issue}>
      {/* The sortable wrapper (KanbanBoard) is the keyboard target; the click opens the issue. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        data-issue-card={issue.identifier}
        onClick={() => onOpen(issue)}
        className="flex cursor-pointer flex-col gap-2 rounded-md border border-border bg-surface p-3 text-ui shadow-xs transition-colors hover:border-text-tertiary/40 hover:bg-surface-hover"
      >
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-mini text-text-tertiary tabular-nums">
            {issue.identifier}
          </span>
          <IssuePicker
            issue={issue}
            kind="assignee"
            align="end"
            trigger={
              <button
                type="button"
                aria-label={`Assignee: ${issue.assignee?.name || issue.assignee?.email || 'Unassigned'}`}
                className={cn(pickerButton, 'rounded-full')}
              >
                <UserAvatar
                  name={issue.assignee ? issue.assignee.name || issue.assignee.email : null}
                  size="xs"
                />
              </button>
            }
          />
        </div>
        <div className="flex items-start gap-2">
          <IssuePicker
            issue={issue}
            kind="status"
            trigger={
              <button
                type="button"
                aria-label={`Status: ${issue.state.name}`}
                className={cn(pickerButton, 'mt-px size-5')}
              >
                <StateIcon state={issue.state} teamStates={teamStates} />
              </button>
            }
          />
          <span
            className={cn(
              'line-clamp-2 min-w-0 flex-1 text-foreground',
              completed && 'text-text-secondary'
            )}
          >
            {issue.title}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <IssuePicker
            issue={issue}
            kind="priority"
            trigger={
              <button
                type="button"
                aria-label={`Priority: ${PRIORITY_LABELS[issue.priority]}`}
                className={cn(pickerButton, 'h-5 border border-border px-1')}
              >
                <PriorityIcon priority={issue.priority} size={12} />
              </button>
            }
          />
          {issue.labels.map(label => (
            <span
              key={label.id}
              className="inline-flex h-5 items-center gap-1.5 rounded-full border border-border px-2 text-micro text-text-secondary"
            >
              <LabelDot color={label.color} />
              {label.name}
            </span>
          ))}
          {issue.due_date ? (
            <span
              className={cn(
                'inline-flex h-5 items-center gap-1 rounded-full border border-border px-2 text-micro text-text-secondary',
                !completed && isOverdue(issue.due_date) && 'text-destructive'
              )}
            >
              <CalendarClock className="size-3" aria-hidden />
              {formatShortDate(issue.due_date)}
            </span>
          ) : null}
        </div>
      </div>
    </IssueContextMenu>
  )
}
