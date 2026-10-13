import type { Cycle } from '@/types/cycle'

/** Cycle dates are calendar days (`YYYY-MM-DD`). All math runs in UTC so time zones never shift a day. */

const DAY_MS = 24 * 60 * 60 * 1000
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Today in the user's time zone, as `YYYY-MM-DD`. */
export function todayDay(): string {
  const now = new Date()
  return toDay(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

export function addDays(day: string, days: number): string {
  return toDay(new Date(parseDay(day).getTime() + days * DAY_MS))
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS)
}

/** "Oct 13", or "Oct 13, 2025" when not in the current year. */
export function formatDay(day: string): string {
  const sameYear = parseDay(day).getUTCFullYear() === parseDay(todayDay()).getUTCFullYear()
  return (sameYear ? SHORT : LONG).format(parseDay(day))
}

export function formatRange(startsAt: string, endsAt: string): string {
  return `${formatDay(startsAt)} – ${formatDay(endsAt)}`
}

/** "Cycle 3", or the custom name. */
export function cycleTitle(cycle: Pick<Cycle, 'name' | 'number'>): string {
  return cycle.name || `Cycle ${cycle.number}`
}

/** A short line about where the cycle is in time: "5 days left", "Starts in 3 days", "Ended Oct 2". */
export function cycleTiming(cycle: Pick<Cycle, 'status' | 'starts_at' | 'ends_at'>): string {
  const today = todayDay()
  if (cycle.status === 'current') {
    const left = daysBetween(today, cycle.ends_at)
    if (left <= 0) return 'Last day'
    return `${left} ${left === 1 ? 'day' : 'days'} left`
  }
  if (cycle.status === 'upcoming') {
    const until = daysBetween(today, cycle.starts_at)
    if (until <= 1) return 'Starts tomorrow'
    return `Starts in ${until} days`
  }
  return `Ended ${formatDay(cycle.ends_at)}`
}

/** Default dates of a new cycle: two weeks right after the team's last cycle (not before today). */
export function nextCycleDates(cycles: Pick<Cycle, 'ends_at'>[]): {
  starts_at: string
  ends_at: string
} {
  const today = todayDay()
  const lastEnd = cycles.reduce<string | null>(
    (latest, c) => (latest === null || c.ends_at > latest ? c.ends_at : latest),
    null
  )
  let start = lastEnd ? addDays(lastEnd, 1) : today
  if (start < today) start = today
  return { starts_at: start, ends_at: addDays(start, 13) }
}
