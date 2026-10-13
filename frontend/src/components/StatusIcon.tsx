import { cn } from '@/lib/utils'
import type { WorkflowStateType } from '@/types/team'

/** The five workflow state types (Linear's model). Same type as the API's `WorkflowStateType`. */
export type StatusType = WorkflowStateType

const DEFAULT_COLORS: Record<StatusType, string> = {
  backlog: 'var(--status-backlog)',
  unstarted: 'var(--status-unstarted)',
  started: 'var(--status-started)',
  completed: 'var(--status-completed)',
  canceled: 'var(--status-canceled)',
}

interface StatusIconProps {
  /** The state type: decides the shape. */
  type: StatusType
  /** Any CSS color (e.g. the state's hex color). Default: the theme color of the type. */
  color?: string
  /** Fill of a `started` state, 0..1 (e.g. 0.5 In Progress, 0.75 In Review). Default 0.5. */
  progress?: number
  /** Pixel size. Default 14. */
  size?: number
  className?: string
  /** Accessible name (e.g. the state name). Without it the icon is decorative. */
  label?: string
}

/** Linear-style status circle: dashed backlog, empty todo, pie for started, check, cross. */
export function StatusIcon({
  type,
  color,
  progress = 0.5,
  size = 14,
  className,
  label,
}: StatusIconProps) {
  // Stored state colors are picked for the dark theme (e.g. Todo #e2e2e2). The
  // light theme caps their lightness (--status-icon-max-l) so they stay visible on white.
  const shown = `oklch(from ${color ?? DEFAULT_COLORS[type]} min(l, var(--status-icon-max-l)) c h)`
  const stroke = 'currentColor'
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 14 14',
    fill: 'none',
    className: cn('shrink-0', className),
    style: { color: shown },
    'data-status-type': type,
    ...a11y,
  }

  if (type === 'completed' || type === 'canceled') {
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="6" fill={stroke} stroke={stroke} strokeWidth="1.5" />
        {type === 'completed' ? (
          <path
            d="M4.5 7.2 6.3 9 9.6 5.3"
            stroke="var(--surface)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M5 5l4 4M9 5 5 9"
            stroke="var(--surface)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
      </svg>
    )
  }

  const ring = (
    <circle
      cx="7"
      cy="7"
      r="6"
      stroke={stroke}
      strokeWidth="1.5"
      strokeDasharray={type === 'backlog' ? '1.4 1.74' : undefined}
    />
  )

  if (type === 'started') {
    // A pie: a circle of radius 2 with a 4-wide stroke draws a filled disc of radius 4.
    const clamped = Math.min(Math.max(progress, 0), 1)
    const circumference = 2 * Math.PI * 2
    return (
      <svg {...common}>
        {ring}
        <circle
          cx="7"
          cy="7"
          r="2"
          stroke={stroke}
          strokeWidth="4"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          transform="rotate(-90 7 7)"
        />
      </svg>
    )
  }

  return <svg {...common}>{ring}</svg>
}
