import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Maximize2, Plus } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { PriorityIcon } from '@/components/PriorityIcon'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import type { Issue, SubIssues } from '@/types/issue'

interface SubIssuesSectionProps {
  subIssues: SubIssues | undefined
  /** In-app path of an issue page, from its identifier. */
  issuePath: (identifier: string) => string
  /** Creates a sub-issue with this title. Resolves when it is saved. */
  onCreate: (title: string) => Promise<unknown>
  creating?: boolean
  /** Opens the full create-issue modal for a sub-issue (all properties). */
  onOpenFullForm?: () => void
}

/** Small ring that fills with the share of completed sub-issues. */
export function ProgressRing({ value, size = 14 }: { value: number; size?: number }) {
  const radius = size / 2 - 1.5
  const circumference = 2 * Math.PI * radius
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={1.5}
        className="stroke-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={1.5}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="stroke-primary transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  )
}

function SubIssueRow({ issue, to }: { issue: Issue; to: string }) {
  const assignee = issue.assignee ? issue.assignee.name || issue.assignee.email : null
  return (
    <li>
      <Link
        to={to as '/'}
        className="flex h-9 items-center gap-2.5 border-b border-border-subtle px-2 text-ui last:border-b-0 hover:bg-surface-hover"
      >
        <PriorityIcon priority={issue.priority} />
        <span className="min-w-14 shrink-0 text-mini whitespace-nowrap text-text-tertiary">
          {issue.identifier}
        </span>
        <StatusIcon type={issue.state.type} color={issue.state.color} label={issue.state.name} />
        <span className="min-w-0 flex-1 truncate text-foreground">{issue.title}</span>
        {assignee ? <UserAvatar name={assignee} size="xs" /> : null}
      </Link>
    </li>
  )
}

/** "Sub-issues" block of the issue page: progress, compact rows and an inline creator. */
export function SubIssuesSection({
  subIssues,
  issuePath,
  onCreate,
  creating,
  onOpenFullForm,
}: SubIssuesSectionProps) {
  const [adding, setAdding] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const items = subIssues?.items ?? []
  const total = subIssues?.total ?? 0
  const completed = subIssues?.completed ?? 0

  const submit = async () => {
    const next = title.trim()
    if (!next || creating) return
    try {
      await onCreate(next)
      setTitle('')
    } catch {
      // The page shows the error; keep the text so the user can retry.
    }
  }

  if (total === 0 && !adding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5 self-start text-text-secondary"
        onClick={() => setAdding(true)}
      >
        <Plus />
        Add sub-issues
      </Button>
    )
  }

  return (
    <section aria-label="Sub-issues" className="flex flex-col">
      <div className="flex h-8 items-center gap-2">
        <h2 className="text-ui font-medium text-foreground">Sub-issues</h2>
        {total > 0 ? (
          <span className="flex items-center gap-1.5 text-mini text-text-secondary">
            <ProgressRing value={total ? completed / total : 0} />
            <span data-testid="sub-issues-progress">
              {completed}/{total}
            </span>
          </span>
        ) : null}
        <IconButton
          label="Add sub-issue"
          icon={<Plus />}
          size="sm"
          className="ml-auto"
          onClick={() => setAdding(true)}
        />
      </div>
      {items.length > 0 ? (
        <ul className="rounded-lg border border-border-subtle">
          {items.map(issue => (
            <SubIssueRow key={issue.id} issue={issue} to={issuePath(issue.identifier)} />
          ))}
        </ul>
      ) : null}
      {adding ? (
        <form
          className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-input px-2.5"
          onSubmit={event => {
            event.preventDefault()
            void submit()
          }}
        >
          <StatusIcon type="unstarted" />
          <input
            // The user asked for the field: focus is expected here.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            aria-label="Sub-issue title"
            placeholder="Sub-issue title"
            maxLength={500}
            value={title}
            onChange={event => setTitle(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setTitle('')
                setAdding(false)
              }
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-ui text-foreground outline-none placeholder:text-text-tertiary"
          />
          {onOpenFullForm ? (
            <IconButton
              label="Create sub-issue with all properties"
              icon={<Maximize2 />}
              size="sm"
              onClick={() => {
                setTitle('')
                setAdding(false)
                onOpenFullForm()
              }}
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setTitle('')
              setAdding(false)
            }}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!title.trim() || creating}>
            Create
          </Button>
        </form>
      ) : null}
    </section>
  )
}
