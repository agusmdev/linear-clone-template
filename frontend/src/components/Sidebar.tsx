import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  Box,
  ChevronRight,
  CircleDot,
  FileText,
  Inbox,
  Layers,
  RefreshCcw,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarLink {
  label: string
  /** In-app path, e.g. `/acme/projects`. */
  to: string
  icon?: React.ReactNode
  /** Small counter on the right (e.g. unread count). Hidden when 0 or undefined. */
  badge?: number
}

export interface SidebarTeam {
  id: string
  name: string
  /** Team key, e.g. "ENG": used for the default icon. */
  key?: string
  /** Icon color (CSS color). Default: accent. */
  color?: string
  issuesTo: string
  cyclesTo: string
  projectsTo: string
  /** More links under the team (e.g. Settings). */
  extraLinks?: SidebarLink[]
}

export interface SidebarProps {
  /** Top-left slot: usually <WorkspaceSwitcher />. */
  workspaceSwitcher?: React.ReactNode
  /** Top-right slot next to the switcher: search / new-issue IconButtons. */
  actions?: React.ReactNode
  inboxTo: string
  /** Unread notifications: a badge on Inbox. */
  inboxCount?: number
  myIssuesTo: string
  projectsTo: string
  documentsTo: string
  viewsTo: string
  /** Optional "Favorites" section (shown when not empty). */
  favorites?: SidebarLink[]
  /** Drag and drop reorder of favorites: move the row at `from` to index `to`. */
  onFavoriteMove?: (from: number, to: number) => void
  teams: SidebarTeam[]
  /** Bottom slot: help, theme toggle, user menu... */
  footer?: React.ReactNode
  className?: string
}

const itemClass =
  'group flex h-7 items-center gap-2 rounded-md px-2 text-ui font-medium text-text-secondary transition-colors duration-100 hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0'

const activeClass = 'bg-surface-active text-foreground hover:bg-surface-active'

/** One nav row. Active when the current URL starts with `to`. */
export function SidebarNavLink({ label, to, icon, badge }: SidebarLink) {
  return (
    <Link
      // Feature routes are dynamic (/$workspace/...): the path string is typed as '/'.
      to={to as '/'}
      className={itemClass}
      activeProps={{ className: activeClass, 'aria-current': 'page' }}
    >
      {icon ? (
        <span className="flex text-text-secondary group-hover:text-foreground">{icon}</span>
      ) : null}
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-surface-active px-1.5 text-micro text-text-secondary">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
}

/** Collapsible group heading ("Workspace", "Your teams"). */
function SidebarSection({ title, children }: SectionProps) {
  const [open, setOpen] = React.useState(true)
  const id = React.useId()
  return (
    <div className="flex flex-col gap-px">
      <button
        type="button"
        className="group flex h-6 items-center gap-1 rounded-md px-2 text-mini font-medium text-text-tertiary hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronRight
          className={cn(
            'size-3 opacity-0 transition-transform group-hover:opacity-100',
            open && 'rotate-90'
          )}
        />
      </button>
      <div id={id} hidden={!open} className="flex flex-col gap-px">
        {children}
      </div>
    </div>
  )
}

function TeamIcon({ team }: { team: SidebarTeam }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold text-white"
      style={{ backgroundColor: team.color ?? 'var(--primary)' }}
    >
      {(team.key ?? team.name).slice(0, 2).toUpperCase()}
    </span>
  )
}

function SidebarTeamItem({ team }: { team: SidebarTeam }) {
  const [open, setOpen] = React.useState(true)
  const id = React.useId()
  const links: SidebarLink[] = [
    { label: 'Issues', to: team.issuesTo, icon: <CircleDot /> },
    { label: 'Cycles', to: team.cyclesTo, icon: <RefreshCcw /> },
    { label: 'Projects', to: team.projectsTo, icon: <Box /> },
    ...(team.extraLinks ?? []),
  ]
  return (
    <div className="flex flex-col gap-px">
      <button
        type="button"
        className={cn(itemClass, 'w-full text-foreground')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <TeamIcon team={team} />
        <span className="truncate">{team.name}</span>
        <ChevronRight
          className={cn('!size-3 text-text-tertiary transition-transform', open && 'rotate-90')}
        />
      </button>
      <div id={id} hidden={!open} className="flex flex-col gap-px pl-5">
        {links.map(link => (
          <SidebarNavLink key={link.label} {...link} />
        ))}
      </div>
    </div>
  )
}

/** Favorite rows; with `onMove` they can be reordered by drag and drop. */
function SidebarFavorites({
  favorites,
  onMove,
}: {
  favorites: SidebarLink[]
  onMove?: (from: number, to: number) => void
}) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)
  if (!onMove) {
    return favorites.map(link => <SidebarNavLink key={link.to} {...link} />)
  }
  const reset = () => {
    setDragIndex(null)
    setOverIndex(null)
  }
  return favorites.map((link, index) => (
    <div
      key={link.to}
      data-testid="sidebar-favorite"
      draggable
      onDragStart={event => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', link.label)
        setDragIndex(index)
      }}
      onDragOver={event => {
        if (dragIndex === null) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOverIndex(index)
      }}
      onDrop={event => {
        event.preventDefault()
        if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index)
        reset()
      }}
      onDragEnd={reset}
      className={cn(
        'rounded-md',
        dragIndex === index && 'opacity-50',
        overIndex === index &&
          dragIndex !== null &&
          dragIndex !== index &&
          (dragIndex < index
            ? 'shadow-[0_1px_0_0_var(--primary)]'
            : 'shadow-[0_-1px_0_0_var(--primary)]')
      )}
    >
      <SidebarNavLink {...link} />
    </div>
  ))
}

/**
 * Linear's left sidebar. Props only: the caller builds the links and data.
 * Top: workspace switcher + actions. Then Inbox, My issues, Favorites,
 * "Workspace" (Projects, Documents, Views) and "Your teams" (one collapsible
 * block per team: Issues, Cycles, Projects).
 */
export function Sidebar({
  workspaceSwitcher,
  actions,
  inboxTo,
  inboxCount,
  myIssuesTo,
  projectsTo,
  documentsTo,
  viewsTo,
  favorites,
  onFavoriteMove,
  teams,
  footer,
  className,
}: SidebarProps) {
  return (
    <nav aria-label="Main" className={cn('flex h-full w-full flex-col bg-sidebar', className)}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-1 px-3">
        <div className="min-w-0">{workspaceSwitcher}</div>
        {actions ? <div className="flex items-center gap-0.5">{actions}</div> : null}
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-px">
          <SidebarNavLink label="Inbox" to={inboxTo} icon={<Inbox />} badge={inboxCount} />
          <SidebarNavLink label="My issues" to={myIssuesTo} icon={<Target />} />
        </div>
        {favorites && favorites.length > 0 ? (
          <SidebarSection title="Favorites">
            <SidebarFavorites favorites={favorites} onMove={onFavoriteMove} />
          </SidebarSection>
        ) : null}
        <SidebarSection title="Workspace">
          <SidebarNavLink label="Projects" to={projectsTo} icon={<Box />} />
          <SidebarNavLink label="Documents" to={documentsTo} icon={<FileText />} />
          <SidebarNavLink label="Views" to={viewsTo} icon={<Layers />} />
        </SidebarSection>
        <SidebarSection title="Your teams">
          {teams.map(team => (
            <SidebarTeamItem key={team.id} team={team} />
          ))}
        </SidebarSection>
      </div>
      {footer ? <div className="flex shrink-0 items-center gap-1 px-3 py-2">{footer}</div> : null}
    </nav>
  )
}
