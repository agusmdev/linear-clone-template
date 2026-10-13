import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Breadcrumb {
  label: string
  /** In-app path. Without it the crumb is plain text. */
  to?: string
  icon?: React.ReactNode
}

interface PageHeaderProps {
  /** Parent pages, left to right (e.g. team, "Issues"). */
  breadcrumbs?: Breadcrumb[]
  /** The page name (the <h1>). Shown after the breadcrumbs. */
  title: React.ReactNode
  /** Icon before the title. */
  icon?: React.ReactNode
  /** Right side: buttons, view switchers, IconButtons. */
  actions?: React.ReactNode
  /** Optional second row: tabs, filters, display options. */
  children?: React.ReactNode
  className?: string
}

/** 44px top bar of a page: breadcrumbs + title (h1) + actions, and an optional toolbar row. */
export function PageHeader({
  breadcrumbs,
  title,
  icon,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('border-b border-border-subtle', className)}>
      <div className="flex h-11 items-center gap-2 px-4">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
        >
          {breadcrumbs?.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${index}`}>
              {crumb.to ? (
                <Link
                  to={crumb.to as '/'}
                  className="flex min-w-0 items-center gap-1.5 rounded px-1 text-ui text-text-secondary hover:text-foreground"
                >
                  {crumb.icon}
                  <span className="truncate">{crumb.label}</span>
                </Link>
              ) : (
                <span className="flex min-w-0 items-center gap-1.5 px-1 text-ui text-text-secondary">
                  {crumb.icon}
                  <span className="truncate">{crumb.label}</span>
                </span>
              )}
              <ChevronRight aria-hidden className="size-3 shrink-0 text-text-tertiary" />
            </React.Fragment>
          ))}
          <h1 className="flex min-w-0 items-center gap-1.5 px-1 text-ui font-medium text-foreground">
            {icon}
            <span className="truncate">{title}</span>
          </h1>
        </nav>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {children ? (
        <div className="flex min-h-10 items-center gap-2 border-t border-border-subtle px-4 py-1.5">
          {children}
        </div>
      ) : null}
    </header>
  )
}
