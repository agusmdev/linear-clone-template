import { StatusIcon } from '@/components/StatusIcon'
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types/project'

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'planned',
  'started',
  'paused',
  'completed',
  'canceled',
]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  started: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
  canceled: 'Canceled',
}

interface ProjectStatusIconProps {
  status: ProjectStatus
  size?: number
  className?: string
  /** Accessible name; without it the icon is decorative. */
  label?: string
}

/** Linear's project status circle: empty (planned), pie (started), pause bars, check, cross. */
export function ProjectStatusIcon({ status, size = 14, className, label }: ProjectStatusIconProps) {
  if (status === 'paused') {
    const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        fill="none"
        className={cn('shrink-0', className)}
        data-project-status="paused"
        {...a11y}
      >
        <circle cx="7" cy="7" r="6" stroke="var(--status-backlog)" strokeWidth="1.5" />
        <path
          d="M5.5 4.75v4.5M8.5 4.75v4.5"
          stroke="var(--status-backlog)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  const type = status === 'planned' ? 'unstarted' : status
  return <StatusIcon type={type} size={size} className={className} label={label} />
}
