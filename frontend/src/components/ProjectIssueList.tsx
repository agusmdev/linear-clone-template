import { Link } from '@tanstack/react-router'
import { PriorityIcon } from '@/components/PriorityIcon'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import type { Issue } from '@/types/issue'
import type { WorkflowStateType } from '@/types/team'

const GROUP_ORDER: WorkflowStateType[] = [
  'started',
  'unstarted',
  'backlog',
  'completed',
  'canceled',
]
const GROUP_LABELS: Record<WorkflowStateType, string> = {
  started: 'In progress',
  unstarted: 'Todo',
  backlog: 'Backlog',
  completed: 'Done',
  canceled: 'Canceled',
}

interface ProjectIssueListProps {
  issues: Issue[]
  /** In-app path of an issue page, by identifier. */
  issueHref: (identifier: string) => string
}

/**
 * Simple issue list of a project, grouped by state type. Stand-in until the
 * shared `IssuesView` (slice "issues-list") is on main; integration swaps it.
 */
export function ProjectIssueList({ issues, issueHref }: ProjectIssueListProps) {
  return (
    <div className="flex flex-col">
      {GROUP_ORDER.map(type => {
        const group = issues.filter(issue => issue.state.type === type)
        if (group.length === 0) return null
        return (
          <section key={type} aria-label={GROUP_LABELS[type]}>
            <h2 className="flex h-9 items-center gap-2 bg-surface-hover/50 px-4 text-ui font-medium">
              <StatusIcon type={type} />
              {GROUP_LABELS[type]}
              <span className="text-text-tertiary">{group.length}</span>
            </h2>
            <ul>
              {group.map(issue => (
                <li key={issue.id}>
                  <Link
                    to={issueHref(issue.identifier) as '/'}
                    className="flex h-10 items-center gap-3 border-b border-border-subtle px-4 hover:bg-surface-hover"
                  >
                    <PriorityIcon priority={issue.priority} />
                    <span className="w-16 shrink-0 text-mini text-text-tertiary">
                      {issue.identifier}
                    </span>
                    <StatusIcon
                      type={issue.state.type}
                      color={issue.state.color}
                      label={issue.state.name}
                    />
                    <span className="flex-1 truncate text-ui text-foreground">{issue.title}</span>
                    <UserAvatar
                      name={issue.assignee ? issue.assignee.name || issue.assignee.email : null}
                      size="sm"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
