# components/command

Command palette, keyboard shortcuts and the shortcuts help dialog. All parts are data-agnostic: they take props and never fetch. Import from `@/components/command`.

## `ShortcutsProvider` + `useShortcut`

Put `<ShortcutsProvider>` once near the app root. It owns one `keydown` listener on `window`.

```tsx
useShortcut(keys, handler, { enabled, scope, allowInInputs, preventDefault })
```

| Arg | Type | Notes |
|---|---|---|
| `keys` | `string \| string[]` | `"c"`, `"/"`, `"?"`, `"mod+k"` (Cmd on Mac, Ctrl elsewhere), `"shift+a"`, sequences `"g i"`. Aliases: `esc`, `enter`, `space`, `up`/`down`/`left`/`right` |
| `handler` | `(e: KeyboardEvent) => void` | Latest handler is always used (no need to memoize) |
| `enabled` | `boolean` (default `true`) | Unregisters when false |
| `scope` | `string` (default `"global"`) | Fires only while the scope is active |
| `allowInInputs` | `boolean` (default `false`) | By default shortcuts are ignored in input/textarea/select/contenteditable |
| `preventDefault` | `boolean` (default `true`) | Calls `preventDefault()` when it fires |

- Sequences: each step must come within 1 s (`SEQUENCE_TIMEOUT_MS`).
- When several shortcuts match, the newest registration wins.
- `useShortcutScope(scope, active?)` activates a scope while the component is mounted (e.g. `"issue-list"` for `j`/`k`).
- `<ShortcutsProvider disabled>` turns everything off.

## `CommandPalette`

```tsx
const [open, setOpen] = useState(false)
useShortcut('mod+k', () => setOpen((o) => !o), { allowInInputs: true })

<CommandPalette
  open={open}
  onOpenChange={setOpen}
  groups={[
    { heading: 'Issues', items: [
      { id: 'create', label: 'Create issue', icon: <PlusIcon />, shortcut: 'c', onSelect: openCreate },
      { id: 'status', label: 'Change status…', childrenPlaceholder: 'Change status to…', children: [
        { heading: 'Status', items: statuses.map((s) => ({ id: `status-${s.id}`, label: s.name, onSelect: () => setStatus(s) })) },
      ] },
    ] },
    { heading: 'Navigation', items: [{ id: 'go-inbox', label: 'Go to inbox', shortcut: 'g i', onSelect: goInbox }] },
  ]}
  onSearchChange={setQuery}          // debounce + fetch on the caller side
  searchGroups={issueResultGroups}   // shown on the root page, not filtered again
  loading={isFetching}
/>
```

| Prop | Type | Notes |
|---|---|---|
| `open`, `onOpenChange` | controlled | Selecting an item closes the palette unless the item has `keepOpen` |
| `groups` | `CommandGroupData[]` | `{ heading, items: CommandItemData[] }`. Filtered by label + `keywords` |
| `onSearchChange` | `(query) => void` | Every input change (also `""` on page change). The text resets on close without a call |
| `searchGroups` | `CommandGroupData[]` | Async results; root page only |
| `loading` | `boolean` | Shows "Searching…" |
| `placeholder`, `emptyMessage`, `className` | `string` | |

`CommandItemData`: `{ id, label, icon?, shortcut?, keywords?, onSelect?, children?, childrenPlaceholder?, keepOpen? }`. `id` must be unique across all visible groups. An item with `children` opens a nested page; Backspace on an empty input or Escape goes back.

## `ShortcutsHelpDialog`

```tsx
const [helpOpen, setHelpOpen] = useState(false)
useShortcut('?', () => setHelpOpen(true))

<ShortcutsHelpDialog
  open={helpOpen}
  onOpenChange={setHelpOpen}
  groups={[
    { heading: 'General', shortcuts: [{ keys: 'mod+k', description: 'Open command menu' }, { keys: '?', description: 'Show shortcuts' }] },
    { heading: 'Navigation', shortcuts: [{ keys: 'g i', description: 'Go to inbox' }, { keys: 'g m', description: 'Go to my issues' }] },
  ]}
/>
```

Props: `open`, `onOpenChange`, `groups: ShortcutHelpGroup[]` (`{ heading, shortcuts: { keys, description }[] }`), `title?`, `className?`.

## Helpers

- `<Kbd keys="mod+k" />`: key caps (`⌘ K` on Mac, `Ctrl K` elsewhere; `G then I` for sequences).
- `formatShortcut`, `parseShortcut`, `parseCombo`, `matchesCombo`, `isTypingTarget`, `isMacPlatform`.

Colors use CSS variables with Linear dark fallbacks, e.g. `var(--color-border,#2a2b2e)`.
