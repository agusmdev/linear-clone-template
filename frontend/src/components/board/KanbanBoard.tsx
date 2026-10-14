import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  buildMoveEvent,
  toIdMap,
  type BoardGroup,
  type GroupedItems,
  type MoveEvent,
} from './types'

export interface KanbanCardState {
  /** True for the copy shown in the drag overlay. */
  isOverlay: boolean
}

export interface KanbanBoardProps<T> {
  columns: readonly BoardGroup[]
  /** Items per column id, in display order. */
  items: GroupedItems<T>
  getItemId: (item: T) => string
  renderCard: (item: T, state: KanbanCardState) => ReactNode
  /** Fired once on drop when the card changed column or position. */
  onMove?: (event: MoveEvent) => void
  /** Shows a "+" button in each column header. */
  onAddInColumn?: (columnId: string) => void
  /** Enter on the focused card (Space lifts it for a keyboard drag). */
  onOpen?: (item: T) => void
  /** Column width in px. Default 348. */
  columnWidth?: number
  className?: string
  'aria-label'?: string
}

const COLUMN_PREFIX = 'kanban-column:'

type DragData = { type: 'column'; columnId: string } | { type: 'card' }

/**
 * Only a pointer in the outer 5% of the board scrolls it sideways (dnd-kit's default is 20%,
 * so a few pixels of drift inside the leftmost visible column scrolled the board).
 */
const AUTO_SCROLL = { threshold: { x: 0.05, y: 0.2 } }

/** Only Space lifts a card, so Enter can open it (dnd-kit's default lifts on Enter too). */
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] }

/**
 * The column under the pointer (or the nearest one when the pointer is in a gap) is the target,
 * so an empty column is a drop target over its whole area. Inside it, the closest card decides
 * the position. Without a pointer (keyboard drag) it falls back to the closest corners.
 */
const boardCollision: CollisionDetection = args => {
  const { droppableContainers, droppableRects, pointerCoordinates } = args
  if (!pointerCoordinates) return closestCorners(args)

  let column: (typeof droppableContainers)[number] | null = null
  let best = Infinity
  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id)
    if (!rect || (container.data.current as DragData | undefined)?.type !== 'column') continue
    const x = pointerCoordinates.x
    const distance = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
    if (distance < best) {
      best = distance
      column = container
    }
  }
  if (!column) return closestCorners(args)

  const columnId = (column.data.current as { columnId: string }).columnId
  const cards = droppableContainers.filter(
    container => container.data.current?.sortable?.containerId === columnId
  )
  const [card] = cards.length > 0 ? closestCenter({ ...args, droppableContainers: cards }) : []
  return card ? [card] : [{ id: column.id, data: { droppableContainer: column, value: 0 } }]
}

/** Linear-style board: horizontal columns, sortable cards, cross-column drag. */
export function KanbanBoard<T>({
  columns,
  items,
  getItemId,
  renderCard,
  onMove,
  onAddInColumn,
  onOpen,
  columnWidth = 348,
  className,
  'aria-label': ariaLabel = 'Board',
}: KanbanBoardProps<T>) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    })
  )

  const propIds = useMemo(() => toIdMap(columns, items, getItemId), [columns, items, getItemId])
  const itemById = useMemo(() => {
    const map = new Map<string, T>()
    for (const column of columns) {
      for (const item of items[column.id] ?? []) map.set(getItemId(item), item)
    }
    return map
  }, [columns, items, getItemId])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [originColumnId, setOriginColumnId] = useState<string | null>(null)
  // Live order while a drag runs; null when idle (props are the source of truth).
  const [dragIds, setDragIds] = useState<Record<string, string[]> | null>(null)
  const ids = dragIds ?? propIds

  const findColumn = (id: UniqueIdentifier, map: Record<string, string[]>): string | null => {
    const key = String(id)
    if (key.startsWith(COLUMN_PREFIX)) return key.slice(COLUMN_PREFIX.length)
    for (const [columnId, columnIds] of Object.entries(map)) {
      if (columnIds.includes(key)) return columnId
    }
    return null
  }

  const reset = () => {
    setActiveId(null)
    setOriginColumnId(null)
    setDragIds(null)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id)
    setActiveId(id)
    setOriginColumnId(findColumn(id, propIds))
    setDragIds(propIds)
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeKey = String(active.id)
    const overIsColumn = (over.data.current as DragData | undefined)?.type === 'column'
    const translated = active.rect.current.translated
    const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2

    setDragIds(prev => {
      if (!prev) return prev
      const from = findColumn(active.id, prev)
      const to = findColumn(over.id, prev)
      if (!from || !to || from === to) return prev

      const target = prev[to]
      let index = target.length
      if (!overIsColumn) {
        const overIndex = target.indexOf(String(over.id))
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length
      }
      return {
        ...prev,
        [from]: prev[from].filter(id => id !== activeKey),
        [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
      }
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const map = dragIds
    const origin = originColumnId
    reset()
    if (!over || !map || !origin) return

    const activeKey = String(active.id)
    const column = findColumn(active.id, map)
    if (!column) return

    let finalIds = map[column]
    const overKey = String(over.id)
    if (findColumn(over.id, map) === column && !overKey.startsWith(COLUMN_PREFIX)) {
      const oldIndex = finalIds.indexOf(activeKey)
      const newIndex = finalIds.indexOf(overKey)
      if (oldIndex !== newIndex) finalIds = arrayMove(finalIds, oldIndex, newIndex)
    }

    const originalIndex = propIds[origin]?.indexOf(activeKey) ?? -1
    const finalIndex = finalIds.indexOf(activeKey)
    if (column === origin && finalIndex === originalIndex) return
    onMove?.(buildMoveEvent(activeKey, origin, column, finalIds))
  }

  const activeItem = activeId ? itemById.get(activeId) : undefined

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={boardCollision}
      autoScroll={AUTO_SCROLL}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <div
        role="region"
        aria-label={ariaLabel}
        className={cn(
          'flex h-full min-h-0 gap-3 overflow-auto px-3 pb-3 text-[13px]',
          'bg-[var(--background,#0f1011)] text-[var(--foreground,#f7f8f8)]',
          className
        )}
      >
        {columns.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            ids={ids[column.id] ?? []}
            itemById={itemById}
            renderCard={renderCard}
            onAdd={onAddInColumn}
            onOpen={onOpen}
            width={columnWidth}
            disabled={!onMove}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeItem !== undefined ? (
          <div className="cursor-grabbing rotate-[1.5deg] shadow-2xl shadow-black/50">
            {renderCard(activeItem, { isOverlay: true })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface KanbanColumnProps<T> {
  column: BoardGroup
  ids: string[]
  itemById: Map<string, T>
  renderCard: (item: T, state: KanbanCardState) => ReactNode
  onAdd?: (columnId: string) => void
  onOpen?: (item: T) => void
  width: number
  disabled: boolean
}

function KanbanColumn<T>({
  column,
  ids,
  itemById,
  renderCard,
  onAdd,
  onOpen,
  width,
  disabled,
}: KanbanColumnProps<T>) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${COLUMN_PREFIX}${column.id}`,
    data: { type: 'column', columnId: column.id } satisfies DragData,
    disabled,
  })
  const count = column.count ?? ids.length

  return (
    <section
      ref={setNodeRef}
      aria-label={column.title}
      className="flex min-h-0 shrink-0 flex-col"
      style={{ width, minWidth: width }}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 bg-[var(--background,#0f1011)] px-1">
        {column.icon ? <span className="flex size-4 items-center">{column.icon}</span> : null}
        <span className="truncate font-medium">{column.title}</span>
        <span className="text-[var(--muted-foreground,#8a8f98)] tabular-nums">{count}</span>
        {onAdd ? (
          <button
            type="button"
            onClick={() => onAdd(column.id)}
            aria-label={`Add to ${column.title}`}
            className="ml-auto rounded p-1 text-[var(--muted-foreground,#8a8f98)] hover:bg-[var(--foreground,#f7f8f8)]/5 hover:text-[var(--foreground,#f7f8f8)]"
          >
            <Plus className="size-4" />
          </button>
        ) : null}
      </header>
      <SortableContext id={column.id} items={ids} strategy={verticalListSortingStrategy}>
        <div
          className={cn(
            // Each column scrolls on its own, so every header and drop area stays in view.
            'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md p-1 transition-colors',
            isOver && 'bg-[var(--foreground,#f7f8f8)]/[0.04]'
          )}
        >
          {ids.map(id => {
            const item = itemById.get(id)
            if (item === undefined) return null
            return (
              <SortableCard
                key={id}
                id={id}
                disabled={disabled}
                onOpen={onOpen ? () => onOpen(item) : undefined}
              >
                {renderCard(item, { isOverlay: false })}
              </SortableCard>
            )
          })}
        </div>
      </SortableContext>
    </section>
  )
}

function SortableCard({
  id,
  disabled,
  onOpen,
  children,
}: {
  id: string
  disabled: boolean
  onOpen?: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'card' } satisfies DragData,
    disabled,
  })

  return (
    // role="button" and tabIndex come from dnd-kit's `attributes`.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary,#5e6ad2)]',
        !disabled && 'cursor-grab',
        isDragging && 'opacity-30'
      )}
      {...attributes}
      {...listeners}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        // Enter on the card itself (not on a picker inside it) opens it, unless a drag runs.
        if (event.key === 'Enter' && event.target === event.currentTarget && !isDragging) {
          event.preventDefault()
          onOpen?.()
          return
        }
        listeners?.onKeyDown?.(event)
      }}
    >
      {children}
    </div>
  )
}
