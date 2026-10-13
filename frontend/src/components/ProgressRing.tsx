import { cn } from '@/lib/utils'

interface ProgressRingProps {
  /** 0-100. */
  percentage: number
  size?: number
  className?: string
}

/** Small circular progress (Linear's project progress), with an accessible progressbar role. */
export function ProgressRing({ percentage, size = 14, className }: ProgressRingProps) {
  const value = Math.max(0, Math.min(100, Math.round(percentage)))
  const radius = 5.25
  const circumference = 2 * Math.PI * radius
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={`${value}% complete`}
      className={cn('shrink-0 -rotate-90', className)}
    >
      <circle cx="7" cy="7" r={radius} stroke="var(--border)" strokeWidth="1.75" />
      {value > 0 ? (
        <circle
          cx="7"
          cy="7"
          r={radius}
          stroke="var(--status-completed)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        />
      ) : null}
    </svg>
  )
}
