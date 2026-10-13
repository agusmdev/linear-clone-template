import type { ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface BulkActionBarProps {
  /** Number of selected items. The bar is hidden when it is 0. */
  count: number
  /** Called by the clear (X) button. */
  onClear: () => void
  /** Action buttons (slot). */
  children?: ReactNode
  /** Text after the count. Default: "selected". */
  label?: string
  className?: string
}

/** Floating bar at the bottom of the viewport for actions on a selection. */
export function BulkActionBar({
  count,
  onClear,
  children,
  label = 'selected',
  className,
}: BulkActionBarProps) {
  if (count <= 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn(
        'fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-lg border p-1 text-[13px] shadow-2xl',
        'animate-in fade-in slide-in-from-bottom-2 duration-150',
        'border-[var(--border,#2a2b2e)] bg-[var(--popover,#1c1d1f)] text-[var(--foreground,#f7f8f8)]',
        className
      )}
    >
      <div className="flex items-center gap-1 rounded-md border border-dashed border-[var(--border,#2a2b2e)] py-1 pr-1 pl-2">
        <span className="tabular-nums">
          {count} {label}
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="rounded p-0.5 text-[var(--muted-foreground,#8a8f98)] hover:bg-white/5 hover:text-[var(--foreground,#f7f8f8)]"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {children ? <div className="flex items-center gap-1">{children}</div> : null}
    </div>
  )
}
