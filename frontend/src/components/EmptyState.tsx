import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** A lucide icon element or any node, shown large and muted. */
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  /** Buttons or links (e.g. "Create issue"). */
  action?: React.ReactNode
  className?: string
}

/** Centered placeholder for an empty list or page. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center',
        className
      )}
    >
      {icon ? (
        <div className="text-text-tertiary [&_svg]:size-10" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-ui font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-ui text-text-secondary [overflow-wrap:anywhere]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
    </div>
  )
}
