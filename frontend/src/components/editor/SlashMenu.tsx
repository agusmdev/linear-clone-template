import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import type { SlashMenuStore } from './slash-command'

export interface SlashMenuProps {
  store: SlashMenuStore
}

/** The floating, keyboard-driven list of blocks shown while the user types `/query`. */
export function SlashMenu({ store }: SlashMenuProps) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    const rect = state.rect
    if (!state.open || !menu || !rect) return
    const reference = { getBoundingClientRect: () => rect }
    const update = () =>
      void computePosition(reference, menu, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        menu.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
        menu.style.visibility = 'visible'
      })
    return autoUpdate(reference, menu, update)
  }, [state.open, state.rect])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [state.selectedIndex, state.items])

  if (!state.open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={menuRef}
      className="rte-root rte-menu fixed top-0 left-0 z-50 w-72"
      style={{ visibility: 'hidden' }}
    >
      {state.items.length === 0 ? (
        <div className="px-3 py-2 text-[13px] text-[var(--rte-muted)]">No matching blocks</div>
      ) : (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Insert block"
          className="max-h-80 overflow-y-auto p-1"
        >
          <div className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-[var(--rte-muted)]">
            Basic blocks
          </div>
          {state.items.map((item, index) => {
            const Icon = item.icon
            const selected = index === state.selectedIndex
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                className="rte-menu-item flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5"
                onMouseEnter={() => store.highlight(index)}
                onMouseDown={event => {
                  event.preventDefault()
                  store.choose(index)
                }}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--rte-border)] bg-[var(--rte-bg)]">
                  <Icon className="size-4 text-[var(--rte-muted)]" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] text-[var(--rte-text)]">{item.title}</span>
                  <span className="truncate text-[12px] text-[var(--rte-muted)]">
                    {item.description}
                  </span>
                </span>
                {item.hint ? (
                  <kbd className="font-mono text-[11px] text-[var(--rte-muted)]">{item.hint}</kbd>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>,
    document.body
  )
}
