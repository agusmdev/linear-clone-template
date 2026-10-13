import { Fragment, useSyncExternalStore } from 'react'

import { cn } from '@/lib/utils'

import { formatShortcut, isMacPlatform } from './keys'

const subscribe = () => () => {}

/** True on Mac after hydration. The server render uses the non-Mac labels. */
function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, isMacPlatform, () => false)
}

export interface KbdProps {
  /** Shortcut string, e.g. "c", "mod+k", "g i". */
  keys: string
  className?: string
}

/** Shows a shortcut as key caps. Sequence steps are joined with "then". */
export function Kbd({ keys, className }: KbdProps) {
  const isMac = useIsMac()
  const steps = formatShortcut(keys, isMac)
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {steps.map((labels, stepIndex) => (
        <Fragment key={stepIndex}>
          {stepIndex > 0 && (
            <span className="text-[11px] text-[var(--color-muted-foreground,#8a8f98)]">then</span>
          )}
          {labels.map((label, labelIndex) => (
            <kbd
              key={labelIndex}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--color-border,#2a2b2e)] bg-[var(--color-muted,#232427)] px-1 font-sans text-[11px] leading-none text-[var(--color-muted-foreground,#8a8f98)]"
            >
              {label}
            </kbd>
          ))}
        </Fragment>
      ))}
    </span>
  )
}
