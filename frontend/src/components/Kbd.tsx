import * as React from 'react'
import { cn } from '@/lib/utils'

/** One key cap: <Kbd>C</Kbd>, <Kbd>⌘</Kbd>. */
export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border bg-surface-hover px-1 font-sans text-micro font-medium text-text-secondary',
        className
      )}
      {...props}
    />
  )
}

interface KbdComboProps {
  /** Keys in order, e.g. ['⌘', 'K'] or ['G', 'then', 'I']. The word "then" is plain text. */
  keys: string[]
  className?: string
}

/** A shortcut made of several keys: <KbdCombo keys={['G', 'then', 'I']} />. */
export function KbdCombo({ keys, className }: KbdComboProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, index) =>
        key === 'then' ? (
          <span key={index} className="text-micro text-text-tertiary">
            then
          </span>
        ) : (
          <Kbd key={index}>{key}</Kbd>
        )
      )}
    </span>
  )
}
