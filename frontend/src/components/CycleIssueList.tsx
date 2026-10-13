import { Link } from '@tanstack/react-router'
import { PriorityIcon } from '@/components/PriorityIcon'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import type { Issue } from '@/types/issue'
import type { WorkflowState } from '@/types/team'

interface CycleIssueListProps {
  issues: Issue[]
  /** The team's states, in board order: they decide the group order. */
  states: WorkflowState[]
  /** Path of an issue page, e.g. identifier => `/acme/issue/ENG-1`. */
  issueTo: (issue: Issue) => string
}

/**
 * The issues of a cycle, grouped by status (Linear list rows).
 * A small local list: the integration step can swap it for the shared IssuesView.
 */
export function CycleIssueList({ issues, states, issueTo }: CycleIssueListProps) {
  const order = new Map(states.map((state, index) => [state.id, index]))
  const groups = new Map<string, { state: Issue['state']; issues: Issue[] }>()
  for (const issue of issues) {
    const group = groups.get(issue.state.id) ?? { state: issue.state, issues: [] }
    group.issues.push(issue)
    groups.set(issue.state.id, group)
  }
  const sorted = [...groups.values()].sort(
    (a, b) => (order.get(a.state.id) ?? 99) - (order.get(b.state.id) ?? 99)
  )

  return (
    <div className="flex flex-col" data-testid="cycle-issues">
      {sorted.map(({ state, issues: rows }) => (
        <section key={state.id} aria-label={state.name}>
          <h3 className="flex h-9 items-center gap-2 border-b border-border-subtle bg-surface-hover/50 px-4 text-ui font-medium text-foreground">
            <StatusIcon type={state.type} color={state.color} />
            {state.name}
            <span className="text-text-tertiary tabular-nums">{rows.length}</span>
          </h3>
          <ul>
            {rows.map(issue => (
              <li key={issue.id}>
                <Link
                  to={issueTo(issue) as '/'}
                  data-testid="cycle-issue-row"
                  className="flex h-10 items-center gap-3 border-b border-border-subtle px-4 text-ui hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
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
                  <span className="min-w-0 flex-1 truncate text-foreground">{issue.title}</span>
                  <span className="hidden items-center gap-1 sm:flex">
                    {issue.labels.map(label => (
                      <Badge key={label.id}>
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                      </Badge>
                    ))}
                  </span>
                  <UserAvatar name={issue.assignee?.name ?? null} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
