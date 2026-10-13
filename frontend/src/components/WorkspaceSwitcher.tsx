import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { colorFor, initialsOf } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'

export interface WorkspaceSummary {
  id: string
  name: string
}

interface WorkspaceLogoProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** Rounded square with the workspace initials on a per-name color. */
export function WorkspaceLogo({ name, size = 'sm', className }: WorkspaceLogoProps) {
  const sizes = { sm: 'size-5 text-[10px]', md: 'size-7 text-[12px]', lg: 'size-10 text-[15px]' }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold text-white',
        sizes[size],
        className
      )}
      style={{ backgroundColor: colorFor(name) }}
    >
      {initialsOf(name)}
    </span>
  )
}

interface WorkspaceSwitcherProps {
  /** The active workspace. */
  current: WorkspaceSummary
  /** All workspaces of the user (the current one included). */
  workspaces: WorkspaceSummary[]
  onSelect: (workspace: WorkspaceSummary) => void
  /** Email of the signed-in user, shown as the list heading. */
  userEmail?: string
  /** Extra DropdownMenuItems under the list: Settings, Create workspace, Log out... */
  children?: React.ReactNode
}

/** Sidebar top-left menu: workspace logo + name; lists workspaces to switch to. */
export function WorkspaceSwitcher({
  current,
  workspaces,
  onSelect,
  userEmail,
  children,
}: WorkspaceSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-7 max-w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-ui font-semibold text-foreground outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:bg-surface-hover"
        aria-label={`Workspace: ${current.name}`}
      >
        <WorkspaceLogo name={current.name} />
        <span className="min-w-0 truncate">{current.name}</span>
        <ChevronDown className="size-3 shrink-0 text-text-secondary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {userEmail ? <DropdownMenuLabel className="truncate">{userEmail}</DropdownMenuLabel> : null}
        {workspaces.map(workspace => (
          <DropdownMenuItem key={workspace.id} onSelect={() => onSelect(workspace)}>
            <WorkspaceLogo name={workspace.name} />
            <span className="truncate">{workspace.name}</span>
            {workspace.id === current.id ? <Check className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
        {children ? (
          <>
            <DropdownMenuSeparator />
            {children}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
