import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface BulkActionBarProps {
  /** Number of selected items. The bar is hidden when it is 0. */
  count: number
  /** Called by the clear (X) button and by Escape anywhere on the page. */
  onClear: () => void
  /** Action buttons (slot). */
  children?: ReactNode
  /** Text after the count. Default: "selected". */
  label?: string
  className?: string
}

/**
 * Floating bar at the bottom of the viewport for actions on a selection.
 * While it is visible, Escape clears the selection wherever the focus is
 * (list, bar buttons, header or body), as in Linear. Escape that an open
 * popover/dialog or a text field already handles is left alone.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
  label = 'selected',
  className,
}: BulkActionBarProps) {
  const onClearRef = useRef(onClear)
  useEffect(() => {
    onClearRef.current = onClear
  })

  const visible = count > 0
  useEffect(() => {
    if (!visible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) {
        return
      }
      event.preventDefault()
      onClearRef.current()
    }
    // Bubble phase: Radix layers (pickers, dialogs) handle Escape first in the
    // capture phase and mark it `defaultPrevented`.
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn(
        // w-max keeps one row on wide screens; on a phone the buttons wrap
        // (the bar never gets wider than the viewport).
        'fixed bottom-6 left-1/2 z-50 flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-lg border p-1 text-[13px] shadow-2xl',
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
          className="rounded p-0.5 text-[var(--muted-foreground,#8a8f98)] hover:bg-[var(--foreground,#f7f8f8)]/5 hover:text-[var(--foreground,#f7f8f8)]"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {children}
    </div>
  )
}
