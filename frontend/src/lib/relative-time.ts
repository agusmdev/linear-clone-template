const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Linear-style relative time: `just now`, `5 min ago`, `2h ago`, `yesterday`, `3d ago`, `Oct 3`. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const diff = now.getTime() - date.getTime()
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 2 * DAY) return 'yesterday'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return formatShortDate(date, now)
}

/** `Oct 3`, or `Oct 3, 2025` when the year is not the current one. */
export function formatShortDate(date: Date, now: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** A `YYYY-MM-DD` date as `Oct 3` (no time zone shift). */
export function formatDueDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return formatShortDate(new Date(year, month - 1, day))
}

/** Full date and time for tooltips: `Oct 3, 2026, 2:15 PM`. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
