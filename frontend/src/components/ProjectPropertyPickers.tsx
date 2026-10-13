import * as React from 'react'
import { CalendarDays, Users, X } from 'lucide-react'
import {
  ProjectStatusIcon,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
} from '@/components/ProjectStatusIcon'
import { PropertyPicker } from '@/components/PropertyPicker'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types/project'
import type { Team } from '@/types/team'
import type { WorkspaceMember } from '@/types/workspace'

const NO_LEAD = 'none'

/** `YYYY-MM-DD` -> "Dec 31" (or "Dec 31, 2027" in another year). Parsed as a local date. */
export function formatProjectDate(value: string | null): string | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const sameYear = year === new Date().getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

const chipClass = 'h-7 gap-1.5 px-2 text-mini text-foreground'

interface StatusPickerProps {
  value: ProjectStatus
  onChange: (status: ProjectStatus) => void
  className?: string
}

export function ProjectStatusPicker({ value, onChange, className }: StatusPickerProps) {
  return (
    <PropertyPicker<ProjectStatus>
      label="Project status"
      placeholder="Change status..."
      options={PROJECT_STATUS_ORDER.map((status, index) => ({
        value: status,
        label: PROJECT_STATUS_LABELS[status],
        icon: <ProjectStatusIcon status={status} />,
        shortcut: String(index + 1),
      }))}
      value={value}
      onChange={onChange}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(chipClass, className)}
          aria-label={`Status: ${PROJECT_STATUS_LABELS[value]}`}
        >
          <ProjectStatusIcon status={value} />
          {PROJECT_STATUS_LABELS[value]}
        </Button>
      }
    />
  )
}

interface LeadPickerProps {
  members: WorkspaceMember[]
  value: string | null
  onChange: (leadId: string | null) => void
  className?: string
}

export function ProjectLeadPicker({ members, value, onChange, className }: LeadPickerProps) {
  const lead = members.find(m => m.user_id === value)?.user
  return (
    <PropertyPicker<string>
      label="Project lead"
      placeholder="Set lead..."
      options={[
        { value: NO_LEAD, label: 'No lead', icon: <UserAvatar name={null} size="xs" /> },
        ...members.map(m => ({
          value: m.user_id,
          label: m.user.name || m.user.email,
          keywords: [m.user.email],
          icon: <UserAvatar name={m.user.name || m.user.email} size="xs" />,
        })),
      ]}
      value={value ?? NO_LEAD}
      onChange={next => onChange(next === NO_LEAD ? null : next)}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(chipClass, className)}
          aria-label={lead ? `Lead: ${lead.name || lead.email}` : 'Lead: none'}
        >
          <UserAvatar name={lead ? lead.name || lead.email : null} size="xs" />
          <span className="max-w-48 truncate">{lead ? lead.name || lead.email : 'Lead'}</span>
        </Button>
      }
    />
  )
}

interface TeamsPickerProps {
  teams: Team[]
  value: string[]
  onChange: (teamIds: string[]) => void
  className?: string
}

export function ProjectTeamsPicker({ teams, value, onChange, className }: TeamsPickerProps) {
  const selected = teams.filter(t => value.includes(t.id))
  const text =
    selected.length === 0
      ? 'Teams'
      : selected.length === 1
        ? selected[0].name
        : `${selected.length} teams`
  return (
    <PropertyPicker<string>
      multiple
      label="Teams"
      placeholder="Add teams..."
      options={teams.map(t => ({
        value: t.id,
        label: t.name,
        keywords: [t.key],
        icon: (
          <span className="flex size-4 items-center justify-center rounded bg-surface-active text-[9px] font-medium text-text-secondary">
            {t.key.slice(0, 2)}
          </span>
        ),
      }))}
      value={value}
      onChange={onChange}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(chipClass, className)}
          aria-label={`Teams: ${selected.map(t => t.name).join(', ') || 'none'}`}
        >
          <Users className="text-text-secondary" />
          {text}
        </Button>
      }
    />
  )
}

interface DatePickerProps {
  /** "Start date" / "Target date": the accessible name and the empty text. */
  label: string
  value: string | null
  onChange: (date: string | null) => void
  className?: string
}

/** A chip that opens a date input; "Clear" sets null. */
export function ProjectDatePicker({ label, value, onChange, className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  const shown = formatProjectDate(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(chipClass, !shown && 'text-text-secondary', className)}
          aria-label={shown ? `${label}: ${shown}` : `${label}: none`}
        >
          <CalendarDays className="text-text-secondary" />
          {shown ?? label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-60 flex-col gap-2 p-2">
        <label htmlFor={id} className="text-mini text-text-secondary">
          {label}
        </label>
        <Input
          id={id}
          type="date"
          value={value ?? ''}
          onChange={event => {
            // An unfinished date gives "": wait for a full date (Clear empties it).
            if (event.target.value) onChange(event.target.value)
          }}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
          >
            <X />
            Clear {label.toLowerCase()}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
