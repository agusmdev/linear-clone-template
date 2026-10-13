import { StatusIcon } from '@/components/StatusIcon'
import { cn } from '@/lib/utils'
import type { CycleProgress as CycleProgressData, CycleStatus } from '@/types/cycle'
import type { WorkflowStateType } from '@/types/team'

/**
 * Linear's cycle icon: a ring whose pie fills with the share of completed
 * issues. Upcoming cycles are dashed, past cycles are solid.
 */
export function CycleIcon({
  status,
  percentage = 0,
  size = 14,
  className,
}: {
  status: CycleStatus
  percentage?: number
  size?: number
  className?: string
}) {
  const r = 5
  const circumference = 2 * Math.PI * r
  const fill = Math.max(0, Math.min(100, percentage)) / 100
  const color =
    status === 'current'
      ? 'var(--primary)'
      : status === 'upcoming'
        ? 'var(--text-tertiary)'
        : 'var(--text-secondary)'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <circle
        cx="7"
        cy="7"
        r="6"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={status === 'upcoming' ? '2.2 1.6' : undefined}
      />
      {fill > 0 ? (
        <circle
          cx="7"
          cy="7"
          r={r / 2}
          stroke={color}
          strokeWidth={r}
          strokeDasharray={`${(fill * circumference) / 2} ${circumference}`}
          transform="rotate(-90 7 7)"
        />
      ) : null}
    </svg>
  )
}

/** Thin bar with the completed share, plus the percentage. */
export function CycleProgressBar({
  percentage,
  className,
  showLabel = true,
}: {
  percentage: number
  className?: string
  showLabel?: boolean
}) {
  const value = Math.max(0, Math.min(100, percentage))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-label="Cycle progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-active"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-9 shrink-0 text-right text-mini tabular-nums text-text-secondary">
          {value}%
        </span>
      ) : null}
    </div>
  )
}

const SCOPE_ORDER: { type: WorkflowStateType; label: string }[] = [
  { type: 'backlog', label: 'Backlog' },
  { type: 'unstarted', label: 'Todo' },
  { type: 'started', label: 'Started' },
  { type: 'completed', label: 'Completed' },
  { type: 'canceled', label: 'Canceled' },
]

/** Compact scope line: "8 issues" + one count per state type that has issues. */
export function CycleScopeCounts({
  progress,
  className,
}: {
  progress: CycleProgressData
  className?: string
}) {
  const parts = SCOPE_ORDER.filter(({ type }) => progress.scope[type] > 0)
  return (
    <div
      className={cn('flex items-center gap-3 text-mini text-text-secondary', className)}
      data-testid="cycle-scope"
    >
      <span className="tabular-nums">
        {progress.total} {progress.total === 1 ? 'issue' : 'issues'}
      </span>
      {parts.map(({ type, label }) => (
        <span
          key={type}
          className="flex items-center gap-1 tabular-nums"
          title={`${label}: ${progress.scope[type]}`}
        >
          <StatusIcon type={type} size={12} label={label} />
          {progress.scope[type]}
        </span>
      ))}
    </div>
  )
}

/** Big scope panel of the cycle page: one tile per state type. */
export function CycleScopeBreakdown({ progress }: { progress: CycleProgressData }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {SCOPE_ORDER.map(({ type, label }) => (
        <div
          key={type}
          className="flex flex-col gap-1 rounded-md border border-border-subtle bg-surface px-3 py-2"
        >
          <dt className="flex items-center gap-1.5 text-mini text-text-secondary">
            <StatusIcon type={type} size={12} />
            {label}
          </dt>
          <dd className="text-ui font-medium tabular-nums text-foreground">
            {progress.scope[type]}
          </dd>
        </div>
      ))}
    </dl>
  )
}
