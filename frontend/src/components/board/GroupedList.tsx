import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  buildMoveEvent,
  toIdMap,
  type BoardGroup,
  type GroupedItems,
  type MoveEvent,
} from './types'

export interface GroupedListRowState {
  selected: boolean
  focused: boolean
}

export interface GroupedListProps<T> {
  groups: readonly BoardGroup[]
  /** Items per group id, in display order. */
  items: GroupedItems<T>
  getItemId: (item: T) => string
  /** Row content. The row is 36px high by default. */
  renderRow: (item: T, state: GroupedListRowState) => ReactNode
  /** Controlled selection. Selection UI is on only when onSelectionChange is set. */
  selectedIds?: ReadonlySet<string>
  onSelectionChange?: (ids: Set<string>) => void
  /** Enter on the focused row, or a plain click on a row. */
  onOpen?: (item: T) => void
  /** Shows a "+" button in each group header. */
  onAddInGroup?: (groupId: string) => void
  /** Turns on drag reorder inside a group (pointer only). */
  onMove?: (event: MoveEvent) => void
  /** Groups that start collapsed. */
  defaultCollapsedIds?: readonly string[]
  /** Row height in px. Default 36. */
  rowHeight?: number
  className?: string
  'aria-label'?: string
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set()

const lockToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** Linear-style list: collapsible groups, multi-select, J/K navigation. */
export function GroupedList<T>({
  groups,
  items,
  getItemId,
  renderRow,
  selectedIds = EMPTY_SELECTION,
  onSelectionChange,
  onOpen,
  onAddInGroup,
  onMove,
  defaultCollapsedIds,
  rowHeight = 36,
  className,
  'aria-label': ariaLabel = 'List',
}: GroupedListProps<T>) {
  const baseId = useId()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(defaultCollapsedIds)
  )
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [anchorId, setAnchorId] = useState<string | null>(null)

  const idMap = useMemo(() => toIdMap(groups, items, getItemId), [groups, items, getItemId])
  const itemById = useMemo(() => {
    const map = new Map<string, T>()
    for (const group of groups) {
      for (const item of items[group.id] ?? []) map.set(getItemId(item), item)
    }
    return map
  }, [groups, items, getItemId])
  // Ids of visible rows (expanded groups only), top to bottom.
  const visibleIds = useMemo(
    () => groups.filter(g => !collapsed.has(g.id)).flatMap(g => idMap[g.id] ?? []),
    [groups, collapsed, idMap]
  )

  const selectable = onSelectionChange !== undefined
  const activeFocusId = focusedId && visibleIds.includes(focusedId) ? focusedId : null
  const rowDomId = (id: string) => `${baseId}-row-${id}`

  useEffect(() => {
    if (!activeFocusId) return
    document.getElementById(`${baseId}-row-${activeFocusId}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeFocusId, baseId])

  const select = (next: Set<string>) => onSelectionChange?.(next)

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    select(next)
    setAnchorId(id)
  }

  const selectRange = (toId: string) => {
    const from = anchorId && visibleIds.includes(anchorId) ? anchorId : toId
    const a = visibleIds.indexOf(from)
    const b = visibleIds.indexOf(toId)
    const next = new Set(selectedIds)
    for (const id of visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(id)
    select(next)
  }

  const handleRowClick = (event: MouseEvent, id: string) => {
    // Keep DOM focus on the listbox so J/K keep working after a click.
    ;(event.currentTarget as HTMLElement).closest<HTMLElement>('[role="listbox"]')?.focus()
    setFocusedId(id)
    if (selectable && event.shiftKey) {
      event.preventDefault()
      selectRange(id)
      return
    }
    if (selectable && (event.metaKey || event.ctrlKey)) {
      toggle(id)
      return
    }
    setAnchorId(id)
    const item = itemById.get(id)
    if (item !== undefined) onOpen?.(item)
  }

  const handleCheckboxClick = (event: MouseEvent, id: string) => {
    event.stopPropagation()
    setFocusedId(id)
    if (event.shiftKey) selectRange(id)
    else toggle(id)
  }

  const moveFocus = (delta: 1 | -1, extend: boolean) => {
    if (visibleIds.length === 0) return
    const current = activeFocusId ? visibleIds.indexOf(activeFocusId) : -1
    const nextIndex =
      current === -1
        ? delta === 1
          ? 0
          : visibleIds.length - 1
        : Math.min(visibleIds.length - 1, Math.max(0, current + delta))
    const nextId = visibleIds[nextIndex]
    setFocusedId(nextId)
    if (extend && selectable) {
      const next = new Set(selectedIds)
      if (activeFocusId) next.add(activeFocusId)
      next.add(nextId)
      select(next)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key
    if (key === 'j' || key === 'J' || key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(1, event.shiftKey)
    } else if (key === 'k' || key === 'K' || key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(-1, event.shiftKey)
    } else if (key === 'Enter' && activeFocusId) {
      event.preventDefault()
      const item = itemById.get(activeFocusId)
      if (item !== undefined) onOpen?.(item)
    } else if ((key === 'x' || key === ' ') && activeFocusId && selectable) {
      event.preventDefault()
      toggle(activeFocusId)
    } else if (key === 'Escape' && selectable && selectedIds.size > 0) {
      event.preventDefault()
      select(new Set())
    }
  }

  const toggleGroup = (groupId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || !onMove) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const groupId = groups.find(g => idMap[g.id]?.includes(activeKey))?.id
    if (!groupId || !idMap[groupId].includes(overKey) || activeKey === overKey) return
    const list = idMap[groupId]
    const finalIds = arrayMove(list, list.indexOf(activeKey), list.indexOf(overKey))
    onMove(buildMoveEvent(activeKey, groupId, groupId, finalIds))
  }

  return (
    <DndContext
      id={`${baseId}-dnd`}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[lockToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <div
        role="listbox"
        aria-label={ariaLabel}
        aria-multiselectable={selectable || undefined}
        aria-activedescendant={activeFocusId ? rowDomId(activeFocusId) : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        // Scroll padding keeps the row that J/K focuses (scrollIntoView) out
        // from under the sticky group header (h-9) and the floating bulk bar.
        className={cn(
          'flex min-h-0 scroll-pt-9 flex-col overflow-auto text-[13px] outline-none',
          'bg-[var(--background,#0f1011)] text-[var(--foreground,#f7f8f8)]',
          selectedIds.size > 0 && 'scroll-pb-32 sm:scroll-pb-20',
          className
        )}
      >
        {groups.map(group => {
          const ids = idMap[group.id] ?? []
          const isCollapsed = collapsed.has(group.id)
          const headerId = `${baseId}-group-${group.id}`
          return (
            <div key={group.id} role="group" aria-labelledby={headerId}>
              <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-[var(--border,#2a2b2e)] bg-[var(--card,#1c1d1f)] pr-2 pl-3">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 shrink-0 text-[var(--muted-foreground,#8a8f98)] transition-transform',
                      !isCollapsed && 'rotate-90'
                    )}
                  />
                  {group.icon ? (
                    <span className="flex size-4 shrink-0 items-center">{group.icon}</span>
                  ) : null}
                  <span id={headerId} className="truncate font-medium">
                    {group.title}
                  </span>
                  <span className="text-[var(--muted-foreground,#8a8f98)] tabular-nums">
                    {group.count ?? ids.length}
                  </span>
                </button>
                {onAddInGroup ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onAddInGroup(group.id)}
                    aria-label={`Add to ${group.title}`}
                    className="rounded p-1 text-[var(--muted-foreground,#8a8f98)] hover:bg-[var(--foreground,#f7f8f8)]/5 hover:text-[var(--foreground,#f7f8f8)]"
                  >
                    <Plus className="size-4" />
                  </button>
                ) : null}
              </div>
              {isCollapsed ? null : (
                <SortableContext id={group.id} items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map(id => {
                    const item = itemById.get(id)
                    if (item === undefined) return null
                    const state = {
                      selected: selectedIds.has(id),
                      focused: activeFocusId === id,
                    }
                    return (
                      <ListRow
                        key={id}
                        id={id}
                        domId={rowDomId(id)}
                        height={rowHeight}
                        state={state}
                        selectable={selectable}
                        showCheckbox={selectedIds.size > 0}
                        draggable={onMove !== undefined}
                        onClick={event => handleRowClick(event, id)}
                        onCheckboxClick={event => handleCheckboxClick(event, id)}
                        onContextMenu={() => setFocusedId(id)}
                      >
                        {renderRow(item, state)}
                      </ListRow>
                    )
                  })}
                </SortableContext>
              )}
            </div>
          )
        })}
        {/* The floating BulkActionBar (fixed, bottom-6) shows while rows are
            selected. This spacer lets the last rows scroll out from under it
            (taller on phones, where the bar wraps onto two rows). */}
        {selectedIds.size > 0 ? (
          <div aria-hidden="true" data-bulk-bar-spacer="" className="h-32 shrink-0 sm:h-20" />
        ) : null}
      </div>
    </DndContext>
  )
}

interface ListRowProps {
  id: string
  domId: string
  height: number
  state: GroupedListRowState
  selectable: boolean
  /** Keep checkboxes visible (a selection exists), not only on hover. */
  showCheckbox: boolean
  draggable: boolean
  onClick: (event: MouseEvent) => void
  onCheckboxClick: (event: MouseEvent) => void
  /** A right-click focuses the row, so keyboard shortcuts act on it afterwards. */
  onContextMenu: () => void
  children: ReactNode
}

function ListRow({
  id,
  domId,
  height,
  state,
  selectable,
  showCheckbox,
  draggable,
  onClick,
  onCheckboxClick,
  onContextMenu,
  children,
}: ListRowProps) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable,
  })

  return (
    // Keyboard access is on the listbox (aria-activedescendant), not on each row.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      ref={setNodeRef}
      id={domId}
      role="option"
      aria-selected={state.selected}
      tabIndex={-1}
      onClick={onClick}
      onContextMenu={onContextMenu}
      {...listeners}
      style={{
        height,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        'group/row relative flex cursor-default items-center gap-2 border-b border-[var(--border,#2a2b2e)]/50 pr-3 pl-1 select-none',
        'hover:bg-[var(--foreground,#f7f8f8)]/[0.03]',
        state.selected && 'bg-[var(--primary,#5e6ad2)]/10 hover:bg-[var(--primary,#5e6ad2)]/15',
        state.focused &&
          'bg-[var(--foreground,#f7f8f8)]/[0.05] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[var(--primary,#5e6ad2)]',
        isDragging && 'z-20 bg-[var(--card,#1c1d1f)] shadow-lg'
      )}
    >
      {selectable ? (
        <span className="flex w-6 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            tabIndex={-1}
            aria-label="Select row"
            checked={state.selected}
            onChange={() => undefined}
            onClick={onCheckboxClick}
            onPointerDown={event => event.stopPropagation()}
            onMouseDown={event => event.preventDefault()}
            className={cn(
              'size-3.5 cursor-pointer accent-[var(--primary,#5e6ad2)] transition-opacity',
              state.selected || showCheckbox
                ? 'opacity-100'
                : 'opacity-0 group-hover/row:opacity-100'
            )}
          />
        </span>
      ) : (
        <span className="w-2 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  )
}
