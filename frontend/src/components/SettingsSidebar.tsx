import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SettingsNavItem {
  label: string
  /** In-app path. */
  to: string
  icon?: React.ReactNode
  /** Active only on this exact path (e.g. the "General" page at /settings). */
  exact?: boolean
}

export interface SettingsNavSection {
  title: string
  items: SettingsNavItem[]
}

interface SettingsSidebarProps {
  /** Where "Back to app" goes. */
  backTo: string
  sections: SettingsNavSection[]
}

const itemClass =
  'flex h-7 items-center gap-2 rounded-md px-2 text-ui font-medium text-text-secondary transition-colors duration-100 hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0'

/** Linear's settings sidebar: replaces the app sidebar under /<ws>/settings. */
export function SettingsSidebar({ backTo, sections }: SettingsSidebarProps) {
  return (
    <nav aria-label="Settings" className="flex h-full w-full flex-col bg-sidebar">
      <div className="flex h-12 shrink-0 items-center px-3">
        <Link to={backTo as '/'} className={cn(itemClass, 'text-foreground')}>
          <ChevronLeft />
          Back to app
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3">
        {sections.map(section => (
          <div key={section.title} className="flex flex-col gap-px">
            <h2 className="flex h-6 items-center px-2 text-mini font-medium text-text-tertiary">
              {section.title}
            </h2>
            {section.items.map(item => (
              <Link
                key={item.to}
                to={item.to as '/'}
                activeOptions={{ exact: item.exact ?? false }}
                className={itemClass}
                activeProps={{
                  className: 'bg-surface-active text-foreground hover:bg-surface-active',
                  'aria-current': 'page',
                }}
              >
                {item.icon ? <span className="flex">{item.icon}</span> : null}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
