const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Linear-style relative time: "just now", "5 min ago", "3 hours ago", "2 days ago", "Oct 3". */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const diff = Math.max(0, now - time)
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY)
    return days === 1 ? 'yesterday' : `${days} days ago`
  }
  const date = new Date(time)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
