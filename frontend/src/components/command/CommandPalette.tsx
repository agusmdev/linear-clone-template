import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { useReturnFocus } from '@/hooks/useReturnFocus'
import { cn } from '@/lib/utils'

import { Kbd } from './Kbd'
import type { CommandGroupData, CommandItemData } from './types'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Static command groups. cmdk filters them by label + keywords. */
  groups: CommandGroupData[]
  /** Called on every change of the search text (debounce on the caller side). */
  onSearchChange?: (query: string) => void
  /**
   * Async result groups (e.g. issues from the API) for the current query.
   * Shown only on the root page and never filtered again by the palette.
   */
  searchGroups?: CommandGroupData[]
  /** Show a "Searching…" row while async results load. */
  loading?: boolean
  /** Default: "Type a command or search…". */
  placeholder?: string
  /** Default: "No results." */
  emptyMessage?: string
  className?: string
}

/**
 * Value prefix of async search items. The server already filtered them, so
 * `filterItems` always keeps them (score 0.5). They stay normal (not `forceMount`) items, so
 * cmdk counts them: it selects the first one and hides `Command.Empty`.
 */
const SEARCH_VALUE_PREFIX = 'search-result:'

/** Case-insensitive match on label + keywords: substring first, then fuzzy. */
function filterItems(value: string, search: string, keywords?: string[]): number {
  // Kept always, ranked below commands whose label or keywords match the query
  // (so "engineering issues" still opens the team page) and above fuzzy matches.
  if (value.startsWith(SEARCH_VALUE_PREFIX)) return 0.5
  const query = search.trim().toLowerCase()
  if (!query) return 1
  const haystack = (keywords ?? []).join(' ').toLowerCase()
  const label = (keywords?.[0] ?? '').toLowerCase()
  if (label.startsWith(query)) return 1
  const tokens = query.split(/\s+/)
  if (tokens.every(token => haystack.includes(token))) return 0.8
  let index = 0
  for (const char of haystack) {
    if (char === query[index]) index++
    if (index === query.length) return 0.3
  }
  return 0
}

const itemClass =
  'flex h-9 cursor-default items-center gap-3 rounded-md px-3 text-[13px] text-[var(--color-foreground,#f7f8f8)] outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-[var(--color-accent,#26272b)]'

const groupClass =
  'px-2 py-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--color-muted-foreground,#8a8f98)]'

interface PaletteItemProps {
  item: CommandItemData
  /** Async search result: always kept by the filter. */
  searchResult?: boolean
  onSelect: (item: CommandItemData) => void
}

function PaletteItem({ item, searchResult, onSelect }: PaletteItemProps) {
  return (
    <Command.Item
      value={searchResult ? `${SEARCH_VALUE_PREFIX}${item.id}` : item.id}
      keywords={[item.label, ...(item.keywords ?? [])]}
      onSelect={() => onSelect(item)}
      className={itemClass}
    >
      {item.icon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-[var(--color-muted-foreground,#8a8f98)] [&_svg]:size-4">
          {item.icon}
        </span>
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.children && <span className="text-[var(--color-muted-foreground,#8a8f98)]">›</span>}
      {item.shortcut && <Kbd keys={item.shortcut} className="shrink-0" />}
    </Command.Item>
  )
}

/**
 * Linear-style command palette (cmdk inside a Radix dialog).
 * Items with `children` open a nested page; Backspace on an empty input or
 * Escape goes back one page.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  onSearchChange,
  searchGroups = [],
  loading = false,
  placeholder = 'Type a command or search…',
  emptyMessage = 'No results.',
  className,
}: CommandPaletteProps) {
  const [pages, setPages] = useState<CommandItemData[]>([])
  const [search, setSearch] = useState('')
  // The highlighted item (cmdk `value`), controlled so new async results can move it.
  const [selected, setSelected] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  const listRef = useRef<HTMLDivElement>(null)
  const returnFocus = useReturnFocus(open)

  // Reset the pages, the search text and the highlight each time the palette closes.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setPages([])
      setSearch('')
      setSelected('')
    }
  }

  // cmdk highlights the first match only while nothing is highlighted, so async
  // results arriving above a command that matched first ("login" -> "Log out")
  // would leave Enter on that command. Highlight the first visible item instead,
  // once cmdk has sorted the new items (next frame).
  const searchResultIds = searchGroups.flatMap(group => group.items.map(item => item.id)).join()
  useEffect(() => {
    if (!searchResultIds) return
    const frame = requestAnimationFrame(() => {
      const first = listRef.current?.querySelector('[cmdk-item]:not([aria-disabled="true"])')
      const value = first?.getAttribute('data-value')
      if (value) setSelected(value)
    })
    return () => cancelAnimationFrame(frame)
  }, [searchResultIds])

  const page = pages.at(-1)
  const visibleGroups = page?.children ?? groups
  const showSearchGroups = !page && searchGroups.length > 0

  const changeSearch = (query: string) => {
    setSearch(query)
    onSearchChange?.(query)
  }

  const popPage = () => {
    setPages(current => current.slice(0, -1))
    changeSearch('')
  }

  const handleSelect = (item: CommandItemData) => {
    if (item.children) {
      setPages(current => [...current, item])
      changeSearch('')
      return
    }
    item.onSelect?.()
    if (!item.keepOpen) onOpenChange(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Backspace' && search === '' && pages.length > 0) {
      event.preventDefault()
      popPage()
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          {...returnFocus}
          onEscapeKeyDown={event => {
            if (pages.length > 0) {
              event.preventDefault()
              popPage()
            }
          }}
          className={cn(
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--color-border,#2a2b2e)] bg-[var(--color-popover,#1c1d1f)] text-[13px] text-[var(--color-foreground,#f7f8f8)] shadow-2xl outline-none',
            className
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search for a command to run.
          </DialogPrimitive.Description>
          {/* No vim bindings: Ctrl+K must reach the mod+k toggle, not move up to "Log out". */}
          <Command
            label="Command menu"
            filter={filterItems}
            loop
            value={selected}
            onValueChange={setSelected}
            vimBindings={false}
            onKeyDown={handleKeyDown}
          >
            {pages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 px-4 pt-3">
                {pages.map(p => (
                  <span
                    key={p.id}
                    className="rounded bg-[var(--color-muted,#232427)] px-1.5 py-0.5 text-[11px] text-[var(--color-muted-foreground,#8a8f98)]"
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            )}
            <Command.Input
              value={search}
              onValueChange={changeSearch}
              placeholder={page?.childrenPlaceholder ?? placeholder}
              className="h-12 w-full border-b border-[var(--color-border,#2a2b2e)] bg-transparent px-4 text-[15px] text-[var(--color-foreground,#f7f8f8)] outline-none placeholder:text-[var(--color-muted-foreground,#8a8f98)]"
            />
            <Command.List
              ref={listRef}
              className="max-h-[min(400px,60vh)] overflow-y-auto overscroll-contain py-1 [scroll-padding-block:8px]"
            >
              {loading && !page && (
                <Command.Loading className="px-5 py-2 text-[var(--color-muted-foreground,#8a8f98)]">
                  Searching…
                </Command.Loading>
              )}
              {!(loading && !page) && (
                <Command.Empty className="px-5 py-6 text-center text-[var(--color-muted-foreground,#8a8f98)]">
                  {emptyMessage}
                </Command.Empty>
              )}
              {showSearchGroups &&
                searchGroups.map(group => (
                  <Command.Group
                    key={`search-${group.heading}`}
                    heading={group.heading}
                    className={groupClass}
                  >
                    {group.items.map(item => (
                      <PaletteItem key={item.id} item={item} searchResult onSelect={handleSelect} />
                    ))}
                  </Command.Group>
                ))}
              {visibleGroups.map(group => (
                <Command.Group key={group.heading} heading={group.heading} className={groupClass}>
                  {group.items.map(item => (
                    <PaletteItem key={item.id} item={item} onSelect={handleSelect} />
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
