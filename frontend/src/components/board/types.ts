import type { ReactNode } from 'react'

/** One column of a KanbanBoard, or one group of a GroupedList. */
export interface BoardGroup {
  id: string
  title: string
  icon?: ReactNode
  /** Shown next to the title. Defaults to the number of items in the group. */
  count?: number
}

/** Items per group id, in display order. */
export type GroupedItems<T> = Record<string, readonly T[]>

/** Fired once on drop, when an item changed column or position. */
export interface MoveEvent {
  itemId: string
  fromColumnId: string
  toColumnId: string
  /** Id of the item directly above the moved item after the drop (null = first). */
  beforeId: string | null
  /** Id of the item directly below the moved item after the drop (null = last). */
  afterId: string | null
  /** Index of the moved item in the target column after the drop. */
  index: number
}

/** Builds a MoveEvent from the final order of the target column. */
export function buildMoveEvent(
  itemId: string,
  fromColumnId: string,
  toColumnId: string,
  finalIds: readonly string[]
): MoveEvent {
  const index = finalIds.indexOf(itemId)
  return {
    itemId,
    fromColumnId,
    toColumnId,
    beforeId: index > 0 ? finalIds[index - 1] : null,
    afterId: index >= 0 && index < finalIds.length - 1 ? finalIds[index + 1] : null,
    index,
  }
}

/** Item ids per group, in display order. */
export function toIdMap<T>(
  groups: readonly BoardGroup[],
  items: GroupedItems<T>,
  getItemId: (item: T) => string
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const group of groups) {
    map[group.id] = (items[group.id] ?? []).map(getItemId)
  }
  return map
}
