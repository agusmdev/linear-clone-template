import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Kbd } from './Kbd'
import type { ShortcutHelpGroup } from './types'

export interface ShortcutsHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: ShortcutHelpGroup[]
  /** Default: "Keyboard shortcuts". */
  title?: string
  className?: string
}

/** Lists keyboard shortcuts in titled groups. Open it with "?" via `useShortcut`. */
export function ShortcutsHelpDialog({
  open,
  onOpenChange,
  groups,
  title = 'Keyboard shortcuts',
  className,
}: ShortcutsHelpDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] fixed top-[12vh] left-1/2 z-50 flex max-h-[76vh] w-[calc(100%-2rem)] max-w-[520px] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-[var(--color-border,#2a2b2e)] bg-[var(--color-popover,#1c1d1f)] text-[13px] text-[var(--color-foreground,#f7f8f8)] shadow-2xl outline-none',
            className
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border,#2a2b2e)] px-4 py-3">
            <DialogPrimitive.Title className="text-[13px] font-medium">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="rounded p-1 text-[var(--color-muted-foreground,#8a8f98)] hover:bg-[var(--color-accent,#26272b)] hover:text-[var(--color-foreground,#f7f8f8)] focus-visible:ring-1 focus-visible:ring-[var(--color-ring,#5e6ad2)] focus-visible:outline-none"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Keyboard shortcuts available in the app.
          </DialogPrimitive.Description>
          <div className="overflow-y-auto px-2 py-2">
            {groups.map(group => (
              <section key={group.heading} className="py-1">
                <h3 className="px-2 py-1.5 text-[11px] font-medium text-[var(--color-muted-foreground,#8a8f98)]">
                  {group.heading}
                </h3>
                <ul>
                  {group.shortcuts.map(shortcut => (
                    <li
                      key={`${shortcut.keys}-${shortcut.description}`}
                      className="flex h-8 items-center justify-between gap-4 rounded px-2 hover:bg-[var(--color-accent,#26272b)]"
                    >
                      <span className="truncate">{shortcut.description}</span>
                      <Kbd keys={shortcut.keys} className="shrink-0" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
