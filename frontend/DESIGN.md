# DESIGN.md — the Linear look

Read this before you build a page. Reuse these tokens and components. Do not add new colors, font sizes or one-off copies of these components.

## 1. Rules

- Dark theme is the default. Every color comes from a token, so the light theme works with no extra code. Do not write hex colors in pages (exception: user data, e.g. a label color or a workflow state color from the API).
- The base UI text is 13px (`text-ui`). Use `text-mini` (12px) for metadata and `text-micro` (11px) for counters and key caps. Page titles in a `PageHeader` are `text-ui font-medium`, as in Linear.
- Keep it compact: rows 32-40px (`h-8` to `h-10`), buttons `h-7`/`h-8`, list padding `px-4`.
- Borders are subtle: `border-border` for controls, `border-border-subtle` for row and section dividers.
- Hover = `bg-surface-hover`. Selected / open = `bg-surface-active`.
- Icon-only buttons are always `IconButton` (it gives the `aria-label` and the tooltip).
- Components in `src/components/` take props only. They never fetch. Pages and hooks fetch and pass data in.

## 2. Tokens (`src/styles/app.css`)

The theme class is on `<html>`: `dark` (default) or `light`. Tailwind variants: `dark:` and `light:`.

### Colors (Tailwind names)

| Token | Use | Dark | Light |
|---|---|---|---|
| `bg-background` / `bg-sidebar` | App canvas, sidebar | `#08090a` | `#f4f5f8` |
| `bg-surface` (= `bg-card`) | Main content panel, cards | `#0f1011` | `#ffffff` |
| `bg-popover` | Menus, popovers, dialogs | `#1c1d1f` | `#ffffff` |
| `bg-surface-hover` | Hover on rows, nav items, ghost buttons | `#1c1d1f` | `#eceef2` |
| `bg-surface-active` | Selected row / nav item, open trigger | `#232427` | `#e4e6eb` |
| `bg-input` | Text inputs | `#141516` | `#ffffff` |
| `border-border` | Controls, popovers | `#2a2b2e` | `#e0e2e7` |
| `border-border-subtle` | Row and section dividers | `#1f2023` | `#eceef2` |
| `text-foreground` / `text-text-primary` | Main text | `#f7f8f8` | `#1b1c1f` |
| `text-text-secondary` (= `text-muted-foreground`) | Secondary text, icons | `#8a8f98` | `#6b6f76` |
| `text-text-tertiary` | Placeholders, identifiers, hints | `#62666d` | `#9a9da3` |
| `bg-primary` / `text-primary` | Accent indigo | `#5e6ad2` | `#5e6ad2` |
| `text-destructive` | Errors, delete | `#eb5757` | `#d93f3f` |
| `status-backlog/unstarted/started/review/completed/canceled` | Default workflow state colors | see css | see css |
| `--status-icon-max-l` | oklch lightness cap of every `StatusIcon` color (stored state hex colors too), so light colors such as Todo `#e2e2e2` stay visible on white | `1` (no cap) | `0.66` |
| `priority-urgent`, `priority-icon`, `priority-icon-empty` | PriorityIcon | see css | see css |

Shadow: `shadow-popover` (menus, dialogs). Radius: `--radius` = 6px (`rounded-md`); `rounded-lg` = 8px; `rounded-xl` = 12px.

### Type

| Class | Size | Use |
|---|---|---|
| `text-micro` | 11px | Counters, `Kbd`, captions |
| `text-mini` | 12px | Labels, metadata, tabs |
| `text-ui` | 13px | Default (body is 13px) |
| `text-title` | 17px | Big headings inside content (e.g. issue title) |

Font: Inter (Google Fonts link in `__root.tsx`), `font-sans`. Mono: JetBrains Mono, `font-mono`.

## 3. Theme

- `ThemeProvider` / `useTheme()` in `src/contexts/ThemeContext.tsx`: `{ theme: 'dark' | 'light', setTheme(theme), toggleTheme() }`. Stored in `localStorage['theme']`. Other tabs follow.
- No flash: `THEME_INIT_SCRIPT` runs in `<head>` and sets the class before the first paint. `<html>` has `suppressHydrationWarning`.
- `<ThemeToggle />` is a ready `IconButton` (label "Switch to light theme" / "Switch to dark theme").
- The `Toaster` follows the theme.

## 4. Layout

### Use the app shell on a page

The public top bar (`Navigation`) shows on every route, except routes that set `staticData: { appShell: true }` (on the route, or on a layout route above it). Those routes render their own `AppShell`:

```tsx
export const Route = createFileRoute('/_authed/$workspace')({
  staticData: { appShell: true },
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  return (
    <AppShell sidebar={<Sidebar {...sidebarProps} />}>
      <Outlet />
    </AppShell>
  )
}
// Each page then starts with <PageHeader ... /> and its content.
```

### `AppShell` (`components/AppShell.tsx`)

| Prop | Type | Notes |
|---|---|---|
| `sidebar` | `ReactNode` | Usually `<Sidebar />`. 240px column on `md+`; a left `Sheet` on small screens (opened by an "Open menu" IconButton). |
| `header?` | `ReactNode` | Top of the main panel, usually `<PageHeader />`. Pages may also render `PageHeader` as the first child instead. |
| `children` | `ReactNode` | Content. It scrolls inside the rounded main panel (`<main>`). |

### `Sidebar` (`components/Sidebar.tsx`)

| Prop | Type | Notes |
|---|---|---|
| `workspaceSwitcher?` | `ReactNode` | Top-left slot: `<WorkspaceSwitcher />`. |
| `actions?` | `ReactNode` | Top-right slot: e.g. search + "New issue" `IconButton`s. |
| `inboxTo`, `myIssuesTo` | `string` | Paths of the first two items. |
| `inboxCount?` | `number` | Unread badge on Inbox (hidden when 0). |
| `projectsTo`, `documentsTo`, `viewsTo` | `string` | "Workspace" section. |
| `favorites?` | `SidebarLink[]` | "Favorites" section, hidden when empty. |
| `onFavoriteMove?` | `(from, to) => void` | Makes favorite rows drag-and-drop reorderable. |
| `teams` | `SidebarTeam[]` | "Your teams" section. Each team is collapsible with Issues, Cycles, Projects (+ `extraLinks`). |
| `footer?` | `ReactNode` | Bottom slot (theme toggle, help, user menu). |

`SidebarLink = { label, to, icon?, badge? }`. `SidebarTeam = { id, name, key?, color?, issuesTo, cyclesTo, projectsTo, extraLinks? }`.
A link is active (`aria-current="page"`, `bg-surface-active`) when the URL starts with its `to`. Paths are plain strings, so dynamic routes work. `SidebarNavLink` is exported for custom rows.

### `WorkspaceSwitcher` (`components/WorkspaceSwitcher.tsx`)

| Prop | Type | Notes |
|---|---|---|
| `current` | `{ id, name }` | Shown in the trigger (aria-label `Workspace: <name>`). |
| `workspaces` | `{ id, name }[]` | Listed with a check on the current one. |
| `onSelect` | `(ws) => void` | Called on pick. |
| `userEmail?` | `string` | Menu heading. |
| `children?` | `ReactNode` | Extra `DropdownMenuItem`s (Settings, Create workspace, Log out). |

`WorkspaceLogo({ name, size?: 'sm' | 'md' | 'lg' })` is exported too (onboarding, settings).

### `PageHeader` (`components/PageHeader.tsx`)

| Prop | Type | Notes |
|---|---|---|
| `title` | `ReactNode` | The page `<h1>` (tests can use `getByRole('heading', { level: 1 })`). |
| `breadcrumbs?` | `{ label, to?, icon? }[]` | Shown before the title with `›` separators. Crumbs and title shrink and truncate, and the nav clips, so on a small screen they never run under the actions. |
| `icon?` | `ReactNode` | Before the title. |
| `actions?` | `ReactNode` | Right side. It does not shrink: keep it compact below `md` (hide text labels, show icons). |
| `children?` | `ReactNode` | Second row (tabs, filter bar, display options). |

## 5. Linear components

### `StatusIcon` (`components/StatusIcon.tsx`)

`<StatusIcon type="started" color={state.color} progress={0.5} size={14} label="In Progress" />`

| Prop | Type | Default |
|---|---|---|
| `type` | `'backlog' \| 'unstarted' \| 'started' \| 'completed' \| 'canceled'` (`StatusType` = `WorkflowStateType` from `@/types/team`) | — |
| `color?` | CSS color (in the light theme its lightness is capped by `--status-icon-max-l`) | theme color of the type |
| `progress?` | `0..1`, fill of `started` (e.g. 0.75 for "In Review") | `0.5` |
| `size?` | px | `14` |
| `label?` | accessible name; without it the icon is decorative | — |

Shapes: backlog = dashed ring, unstarted = empty ring, started = ring + pie, completed = filled + check, canceled = filled + cross.

### `PriorityIcon` (`components/PriorityIcon.tsx`)

`<PriorityIcon priority={2} />`. `Priority` (= `IssuePriority` from `@/types/issue`: 0 | 1 | 2 | 3 | 4) (0 none, 1 urgent, 2 high, 3 medium, 4 low). Props: `priority`, `size?` (14), `labelled?` (adds `role="img"` + label). Exports `PRIORITY_LABELS` and `PRIORITY_ORDER`.

### `UserAvatar` (`components/UserAvatar.tsx`)

`<UserAvatar name={user.display_name || user.email} size="sm" />`

| Prop | Type | Default |
|---|---|---|
| `name?` | `string \| null` — null/undefined renders the dashed "Unassigned" circle | — |
| `src?` | image URL; falls back to initials | — |
| `size?` | `'xs' 16 \| 'sm' 20 \| 'md' 24 \| 'lg' 32 \| 'xl' 48` | `'md'` |
| `online?` | presence dot | — |

Initials on a stable per-name color. Helpers `initialsOf(name)` and `colorFor(name)` are exported. Accessible name = the name (or "Unassigned").

### `Kbd`, `KbdCombo` (`components/Kbd.tsx`)

`<Kbd>C</Kbd>`, `<KbdCombo keys={['G', 'then', 'I']} />` ("then" prints as text).

### `IconButton` (`components/IconButton.tsx`)

`<IconButton label="New issue" icon={<SquarePen />} shortcut="C" onClick={...} />`

| Prop | Type | Default |
|---|---|---|
| `label` | accessible name and tooltip text (required) | — |
| `icon` | element | — |
| `shortcut?` | shown as `Kbd` in the tooltip | — |
| `size?` | `'sm' 24px \| 'md' 28px \| 'lg' 32px` | `'md'` |
| `variant?` | `'ghost' \| 'outline'` | `'ghost'` |
| `active?` | pressed look | — |
| `tooltip?` | `false` drops the tooltip | `true` |
| `tooltipSide?` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'bottom'` |

Plus every `<button>` prop. It works as a Radix `asChild` trigger: `<DropdownMenuTrigger asChild><IconButton .../></DropdownMenuTrigger>`. It shows the open look when the trigger has `data-state="open"`. `TooltipProvider` is already in `__root.tsx`.

### `FavoriteButton` (`components/FavoriteButton.tsx`)

`<FavoriteButton entityType="issue" entityId={issue.id} />`: star `IconButton` ("Add to favorites" / "Remove from favorites", `aria-pressed`) that adds or removes the entity from my sidebar favorites. Only under `routes/_authed/$workspaceKey` (it reads the current workspace and the favorites query). `entityType`: `issue | project | document | team`.

### `WorkspaceCommands` (`components/WorkspaceCommands.tsx`)

Mounted once by the workspace layout: Cmd/Ctrl+K command palette (navigation, create, theme, log out, favorites and async search of issues/projects/documents), the global shortcuts (`C`, `/`, `?`, `G` then `I/M/P/D/S`) and the shortcuts help. Open it from anywhere with `openCommandPalette()` (= `window.dispatchEvent(new CustomEvent('linear:command-palette'))`).

### `EmptyState` (`components/EmptyState.tsx`)

`<EmptyState icon={<Inbox />} title="No issues" description="..." action={<Button size="sm">Create issue</Button>} />`. Props: `title`, `icon?`, `description?`, `action?`, `className?`.

### `PropertyPicker` (`components/PropertyPicker.tsx`)

The one picker for status, priority, assignee, labels, project, cycle. A popover with a search box (cmdk): arrow keys move, Enter picks, Esc closes, case-insensitive substring search on `label` + `keywords`.

```tsx
<PropertyPicker
  label="Status"
  placeholder="Change status..."
  options={states.map((s, i) => ({
    value: s.id,
    label: s.name,
    icon: <StatusIcon type={s.type} color={s.color} />,
    shortcut: String(i + 1),
  }))}
  value={issue.state_id}
  onChange={stateId => update.mutate({ state_id: stateId })}
  trigger={<Button variant="ghost" size="sm">...</Button>}
/>

<PropertyPicker multiple label="Labels" options={labelOptions} value={labelIds} onChange={setLabelIds} trigger={...} />
```

| Prop | Type | Notes |
|---|---|---|
| `options` | `PropertyOption<V>[]` | `{ value, label, icon?, keywords?, shortcut?, group?, disabled? }` |
| `value` / `onChange` | single: `V \| null` / `(v: V) => void`; with `multiple`: `V[]` / `(v: V[]) => void` | Single closes on pick and shows a check on the current value. Multi shows checkboxes and stays open. |
| `trigger` | `ReactNode` | A button; rendered with `PopoverTrigger asChild`. |
| `label?` | `string` | Accessible name of the list. |
| `placeholder?`, `emptyText?` | `string` | `'Search...'`, `'No results'` |
| `open?`, `onOpenChange?` | controlled open, for shortcuts (`S`, `P`, `A`) | |
| `align?`, `side?`, `contentClassName?` | popover placement / width (default `w-64`) | |
| `footer?` | `ReactNode` | Extra `CommandItem`s under a separator (e.g. "Create label"). Give them `forceMount` so the search does not hide them. |

`shortcut` keys pick an option while the search box is empty (Linear's number keys). "No assignee" / "No project" are normal options with a special value (e.g. `'none'`): map it in the page.

### Settings components (WS-1..WS-7)

| Component | File | Use |
|---|---|---|
| `SettingsSidebar({ backTo, sections })` | `components/SettingsSidebar.tsx` | Replaces the app sidebar under `/<ws>/settings` ("Back to app" + grouped links; `exact` for index pages). Sections come from `settingsSections(base, teams)` in `features/workspaces/settings-nav.tsx` |
| `SettingsPage({ title, description?, actions?, children })` | `components/SettingsPage.tsx` | Centered 680px column with a 24px title (an h2: the `PageHeader` holds the h1) |
| `SettingsSection({ title?, description?, actions?, children })`, `SettingsCard`, `SettingsRow({ label, description?, children })` | `components/SettingsPage.tsx` | A titled group; a bordered box whose children get subtle dividers; a "label + control" row |
| `ColorPicker({ value, onChange, label, trigger?, disabled? })` | `components/ColorPicker.tsx` | Palette popover (Linear's 10 colors, `COLOR_PALETTE`) + hex field. Default trigger: a swatch button named `"<label>: <hex>"` |
| `ConfirmDialog({ open, onOpenChange, title, description?, confirmLabel, onConfirm, pending?, canConfirm?, destructive?, children? })` | `components/ConfirmDialog.tsx` | Confirmation for delete / remove / leave; `children` adds a field (type-to-confirm, a target select) |
| `CreateTeamDialog({ open, onOpenChange, onSubmit, pending? })` | `components/CreateTeamDialog.tsx` | Team name, key (follows the name until edited), color |
| `TeamBadge({ team, size? })` | `features/workspaces/settings-nav.tsx` | Square with the team key on the team color |

## 6. shadcn/ui primitives (`components/ui/`)

Restyled to the tokens. Same API as shadcn (new-york):

`button` (sizes `sm` 28px, `default` 32px, `lg` 40px, `icon`), `input` (32px), `label`, `textarea`, `card`, `dialog`, `alert-dialog`, `form`, `sonner`, `dropdown-menu`, `context-menu`, `popover`, `command` (incl. `CommandDialog` for the Cmd+K palette), `tooltip`, `avatar`, `select`, `checkbox`, `switch`, `tabs` (Linear pill tabs), `separator`, `scroll-area`, `sheet`, `badge` (`outline` default, `secondary`, `default`, `destructive`), `skeleton`.

Menus share `menuContentClass` / `menuItemClass` (exported from `ui/dropdown-menu.tsx`): use them for any custom floating list.

## 7. Patterns

- Issue row: `h-10 px-4 border-b border-border-subtle hover:bg-surface-hover`, order: `PriorityIcon`, identifier (`text-text-tertiary w-16`), `StatusIcon`, title (`truncate flex-1`), labels (`Badge` with a color dot), date (`text-mini text-text-tertiary`), `UserAvatar size="sm"`.
- Group header in a list: `h-9 bg-surface-hover/50 px-4 text-ui font-medium` + `StatusIcon` + count in `text-text-tertiary`.
- Label chip: `<Badge><span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />{label.name}</Badge>`.
- Loading: `Skeleton` rows with the same height as the real rows.

## 8. Issues (`components/issues/`)

- `IssuesView` (`components/issues/IssuesView.tsx`): the shared issue list / board. Props: `params: IssuesParams` (the base query, e.g. `{ workspace_id, team_id }`), `defaultLayout?: 'list' | 'board'`, `groupBy?: 'status' | 'assignee' | 'priority' | 'project' | 'none'`, `emptyState?`, `createDefaults?` (defaults of the create modal from group "+" buttons), `hiddenFilters?`, `toolbarActions?`. It renders its own toolbar (filters, search, Display options) and keeps the view state in the URL (`?layout=board&group=priority&order=created&subs=hide&completed=hide&status=<ids>&priority=urgent,high&assignee=me,none&label=<ids>&q=text`). Must be used under `routes/_authed/$workspaceKey/`. Used by the team issues page, My issues, the project page's Issues tab (`project_id`) and the cycle page (`cycle_id`). A route that has `validateSearch` must pass the unknown search keys through, or the view state is lost.
- Keyboard in the list: `J`/`K` move, `Enter` opens, `X` selects, `S`/`P`/`A`/`L` open the status / priority / assignee / labels picker of the focused row, `Cmd+Backspace` deletes (with confirm). Right-click a row or card for the context menu.
- Create issue from anywhere: `openCreateIssue({ teamId?, stateId?, projectId?, cycleId?, parentId?, assigneeId? })` from `@/lib/issue-events` (= `window.dispatchEvent(new CustomEvent('linear:create-issue', { detail }))`). The modal (`CreateIssueHost`) is mounted once in the workspace layout and also opens on the `C` key.
- Property changes: `useIssueActions()` (`hooks/useIssueActions.ts`) = optimistic PATCH for one issue, `POST /issues/bulk-update` for many. `archiveIssues` (context menu, bulk bar) sends `archived: true`.
- Issue mutations call `invalidateIssueCaches(queryClient)` (`hooks/useIssues.ts`): it refreshes `issues`, `projects` and `cycles`, so the project and cycle progress stays current.
