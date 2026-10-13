# board/ — list, Kanban board and bulk action bar

Generic, data-agnostic Linear-style views. They take data and callbacks as props, never fetch.
Drag and drop uses `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2.

```ts
import { KanbanBoard, GroupedList, BulkActionBar, type MoveEvent } from '@/components/board'
```

## Shared types (`types.ts`)

| Type                | Shape                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| `BoardGroup`        | `{ id: string; title: string; icon?: ReactNode; count?: number }`            |
| `GroupedItems<T>`   | `Record<groupId, readonly T[]>` (display order)                               |
| `MoveEvent`         | `{ itemId, fromColumnId, toColumnId, beforeId, afterId, index }`              |
| `buildMoveEvent(…)` | Helper that builds a `MoveEvent` from the final id order of a column          |

`beforeId` = the item directly **above** the moved item after the drop (`null` = first).
`afterId` = the item directly **below** it (`null` = last). Use them to compute a sort order
(for example the midpoint between the two neighbours). `count` defaults to the item count.

## `KanbanBoard<T>`

| Prop            | Type                                             | Notes                                       |
| --------------- | ------------------------------------------------ | ------------------------------------------- |
| `columns`       | `BoardGroup[]`                                   | Column order                                |
| `items`         | `GroupedItems<T>`                                | Cards per column id                         |
| `getItemId`     | `(item: T) => string`                            | Stable id, unique on the board              |
| `renderCard`    | `(item: T, { isOverlay }) => ReactNode`          | `isOverlay` = copy in the drag overlay      |
| `onMove`        | `(e: MoveEvent) => void`                         | On drop, only when column or index changed. |
| `onAddInColumn` | `(columnId: string) => void`                     | Shows a "+" in each column header           |
| `columnWidth`   | `number` (default 348)                           |                                             |
| `className`     | `string`                                         | Give the board a height (e.g. `h-full`)     |

- Without `onMove`, drag is off.
- Cross-column moves show live while dragging; the board keeps a local copy of the order
  during the drag and goes back to `items` on drop. Update `items` in `onMove` (optimistic
  update), or the card snaps back.
- Horizontal scroll, sticky column headers, drag overlay with drop animation.
- Keyboard: focus a card with Tab, Space to lift, arrows to move, Space to drop, Escape to
  cancel. Screen reader announcements come from dnd-kit.

```tsx
<KanbanBoard
  className="h-full"
  columns={statuses.map(s => ({ id: s.id, title: s.name, icon: <StatusIcon status={s} /> }))}
  items={issuesByStatus}
  getItemId={issue => issue.id}
  renderCard={issue => <IssueCard issue={issue} />}
  onMove={({ itemId, toColumnId, beforeId, afterId }) =>
    moveIssue.mutate({ id: itemId, statusId: toColumnId, beforeId, afterId })
  }
  onAddInColumn={statusId => openCreateIssue({ statusId })}
/>
```

## `GroupedList<T>`

| Prop                  | Type                                       | Notes                                        |
| --------------------- | ------------------------------------------ | -------------------------------------------- |
| `groups`              | `BoardGroup[]`                             | Group order                                  |
| `items`               | `GroupedItems<T>`                          | Rows per group id                            |
| `getItemId`           | `(item: T) => string`                      |                                              |
| `renderRow`           | `(item: T, { selected, focused }) => Node` | Row content; the row is `rowHeight` high     |
| `selectedIds`         | `ReadonlySet<string>`                      | Controlled selection                         |
| `onSelectionChange`   | `(ids: Set<string>) => void`               | Set it to turn on selection UI               |
| `onOpen`              | `(item: T) => void`                        | Plain click or Enter on the focused row      |
| `onAddInGroup`        | `(groupId: string) => void`                | Shows a "+" in each group header             |
| `onMove`              | `(e: MoveEvent) => void`                   | Optional: drag reorder inside a group        |
| `defaultCollapsedIds` | `string[]`                                 | Groups that start collapsed                  |
| `rowHeight`           | `number` (default 36)                      |                                              |
| `className`           | `string`                                   | Give it a height to scroll inside            |

Interaction:

- Click a group header to collapse or expand it.
- Mouse: click = open, Cmd/Ctrl-click = toggle, Shift-click = range from the last clicked
  row, checkbox (shown on hover, always shown when a selection exists) = toggle.
- Keyboard (the list is one tab stop, rows use `aria-activedescendant`): `J`/`ArrowDown`
  and `K`/`ArrowUp` move focus, add Shift to extend the selection, `X` or Space toggles the
  focused row, `Enter` opens it, `Escape` clears the selection.
- Drag reorder is pointer only and stays inside the group (`fromColumnId === toColumnId`).

## `BulkActionBar`

| Prop        | Type         | Notes                                       |
| ----------- | ------------ | ------------------------------------------- |
| `count`     | `number`     | Hidden when 0                               |
| `onClear`   | `() => void` | The X button                                |
| `children`  | `ReactNode`  | Action buttons                              |
| `label`     | `string`     | Text after the count (default `"selected"`) |
| `className` | `string`     |                                             |

While `selectedIds` is not empty, `GroupedList` adds an 80px spacer after its
last row, so the last rows can scroll out from under the floating bar.

```tsx
const [selected, setSelected] = useState<Set<string>>(new Set())

<GroupedList
  groups={groups}
  items={issuesByStatus}
  getItemId={i => i.id}
  renderRow={issue => <IssueRow issue={issue} />}
  selectedIds={selected}
  onSelectionChange={setSelected}
  onOpen={issue => navigate({ to: '/issue/$id', params: { id: issue.id } })}
/>
<BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
  <Button size="sm" variant="ghost">Status</Button>
  <Button size="sm" variant="ghost">Assignee</Button>
</BulkActionBar>
```

## Styling

Plain Tailwind with the shadcn theme variables and Linear dark fallbacks:
`--background` (#0f1011), `--card` (#1c1d1f), `--popover`, `--border` (#2a2b2e),
`--foreground` (#f7f8f8), `--muted-foreground` (#8a8f98), `--primary` (#5e6ad2). Text is 13px.
