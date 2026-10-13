const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** Short relative time, as Linear prints it: "now", "5m", "3h", "2d", "4w", then "Mar 3". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const date = new Date(iso)
  const diff = Math.max(0, now - date.getTime())
  if (diff < MINUTE) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d`
  if (diff < 5 * WEEK) return `${Math.floor(diff / WEEK)}w`
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Full date and time for a tooltip / title attribute. */
export function fullDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
