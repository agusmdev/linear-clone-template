import { cn } from '@/lib/utils'
import { ISSUE_PRIORITY_LABELS, type IssuePriority } from '@/types/issue'

/** Linear's priority scale: 0 none, 1 urgent, 2 high, 3 medium, 4 low. Same type as the API's `IssuePriority`. */
export type Priority = IssuePriority

export const PRIORITY_LABELS: Record<Priority, string> = ISSUE_PRIORITY_LABELS

/** Order of the priority menu, as in Linear. */
export const PRIORITY_ORDER: Priority[] = [0, 1, 2, 3, 4]

interface PriorityIconProps {
  priority: Priority
  /** Pixel size. Default 14. */
  size?: number
  className?: string
  /** Give the icon an accessible name (the priority label). Default false: decorative. */
  labelled?: boolean
}

/** Signal bars for high/medium/low, an orange "!" box for urgent, three dots for none. */
export function PriorityIcon({
  priority,
  size = 14,
  className,
  labelled = false,
}: PriorityIconProps) {
  const a11y = labelled
    ? { role: 'img', 'aria-label': PRIORITY_LABELS[priority] }
    : { 'aria-hidden': true }
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 14 14',
    fill: 'none',
    className: cn('shrink-0', className),
    'data-priority': priority,
    ...a11y,
  }

  if (priority === 0) {
    return (
      <svg {...common}>
        {[2, 6, 10].map(x => (
          <rect
            key={x}
            x={x - 0.5}
            y="6.25"
            width="3"
            height="1.5"
            rx="0.75"
            fill="var(--priority-icon)"
          />
        ))}
      </svg>
    )
  }

  if (priority === 1) {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--priority-urgent)" />
        <path d="M7 3.8v4" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7" cy="10.1" r="0.9" fill="var(--surface)" />
      </svg>
    )
  }

  // high = 3 bars, medium = 2, low = 1
  const filled = 5 - priority
  const bars = [
    { x: 1.5, height: 4 },
    { x: 5.5, height: 7 },
    { x: 9.5, height: 10 },
  ]
  return (
    <svg {...common}>
      {bars.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={12 - bar.height}
          width="3"
          height={bar.height}
          rx="1"
          fill={index < filled ? 'var(--priority-icon)' : 'var(--priority-icon-empty)'}
        />
      ))}
    </svg>
  )
}
