# Linear UX reference

This is the UI/UX reference for the agents that build the Linear clone. Use it with
`FEATURES.md`: `FEATURES.md` says **what** to build, and this file says **how it must look and
behave** to feel like Linear.

How to read this file:

- **[docs]** means the fact comes from the public Linear docs (linear.app/docs) or Linear's
  enablement guides. You can trust it.
- **[observed]** means the fact comes from the real app, screenshots, third-party shortcut
  lists or Linear API data. It is not on a public docs page. It is precise enough to build
  with, but small details can differ in the current Linear version.
- **[clone]** means a decision for this clone (Linear does more, or the docs do not say).
- Scope: build only what `FEATURES.md` asks for. Sections about Linear features that are not
  in `FEATURES.md` (triage, SLA, initiatives, customers) are context only. Do not build them.

Visual base for every section (from the task brief, matches Linear dark theme):

| Token             | Value                                               | Use                                           |
| ----------------- | --------------------------------------------------- | --------------------------------------------- |
| `--color-bg`      | `#0f1011`                                           | App background, main content                  |
| `--color-surface` | `#1c1d1f`                                           | Sidebar hover, menus, modals, cards           |
| `--color-border`  | `#2a2b2e`                                           | 1px borders, row dividers                     |
| `--color-text`    | `#f7f8f8`                                           | Primary text                                  |
| `--color-muted`   | `#8a8f98`                                           | Secondary text, icons, identifiers, dates     |
| `--color-accent`  | `#5e6ad2`                                           | Primary buttons, focus ring, selection, links |
| Font              | Inter, 13px base, 12px for meta, 15-24px for titles |                                               |
| Radius            | 4-6px for chips/buttons, 8-12px for modals/menus    |                                               |

---

## 1. App layout

```
+--------------------+--------------------------------------------------------------+
| Sidebar (~220-244px, resizable, collapsible)                                     |
| [Workspace v] [search] [new issue]  | Header: breadcrumb / title   [view tabs]   |
|                                     |         [filter] [display]   [...]        |
| Inbox                         (3)   +-----------------------------------------+  |
| My issues                           | Main content (list / board / page)      |  |
|                                     |                                         |  |
| Workspace                           |                                         |  |
|   Projects                          |                                         |  |
|   Views                             |                                         |  |
|   (Documents) [clone]               |                                         |  |
|                                     |                                         |  |
| Favorites                           |                                         |  |
|   ...                               |                                         |  |
|                                     |                                         |  |
| Your teams                          |                                         |  |
|   v [E] Engineering                 |                                         |  |
|       Triage (if on)                |                                         |  |
|       Issues                        |                                         |  |
|       Cycles                        |                                         |  |
|       Projects                      |                                         |  |
|       Views                         |                                         |  |
|                                     |                                         |  |
| (bottom) Invite people / Help       |                                         |  |
+-------------------------------------+-----------------------------------------+--+
```

### 1.1 Sidebar

Order from top to bottom [docs: "Navigating Linear" guide lists Inbox, My Issues, Workspace,
Your teams, Favorites; observed: Favorites is shown above Your teams when it has items]:

1. **Top bar** [observed]: workspace switcher (workspace logo square with initials + workspace
   name + chevron). Right of it: a **search** icon button (`/`) and a **New issue** icon button
   (square-with-pencil, `C`). Workspace menu items: Settings, Invite and manage members,
   Download desktop app, Switch workspace (`O` then `W`), Log out (`Alt+Shift+Q`).
2. **Inbox** (with unread count badge on the right) [docs].
3. **My issues** [docs].
4. **Workspace** section header (collapsible) [docs]: Projects, Views, (Initiatives — not in
   scope). [clone]: put **Documents** here too (Linear puts documents inside
   projects/teams; `FEATURES.md` DOC-1 asks for a sidebar entry).
5. **Favorites** section [docs]: pinned issues, projects, documents, views. Hidden when empty.
   Items are drag-reorderable.
6. **Your teams** section [docs]: one collapsible group per team. Team row = small colored
   team icon + team name + chevron. Children (indented 1 level):
   - Triage (only when triage is on) — not in scope
   - **Issues** (opens team issues with tabs All issues / Active / Backlog)
   - **Cycles** (only when cycles are on for the team)
   - **Projects**
   - **Views**
7. **Bottom** [observed]: "Invite people" and a "?" Help menu (Keyboard shortcuts, Docs,
   Changelog, Contact us).

Sidebar row style [observed]: 28px high, 6px radius, 8px horizontal padding, 16px icon in
muted color, 13px label. Hover: surface background. Active route: slightly lighter surface
background + primary text color. Section headers: 12px, muted, no uppercase, with a chevron on
hover that collapses the section.

### 1.2 Header (top of main content)

[observed] One 44-48px row, 1px border at the bottom:

- **Left**: breadcrumb / title. Team views: team icon + `Engineering` › then the **view tabs**
  inline: `All issues` `Active` `Backlog` (pill buttons; active tab has surface background).
  A `+` or "..." after the tabs adds/saves a custom view.
- **Right**: notification bell / subscribe (some pages), **Filter** button (funnel icon,
  `F`), **Display** button (sliders icon, label "Display"), and a sidebar-toggle for detail
  panels (`Cmd/Ctrl+I`).
- When filters are applied, a **second row** appears under the header with filter chips (see
  section 6) and a "Clear" action.

### 1.3 Standard view tabs [docs + observed]

| Page         | Tabs                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| Team issues  | All issues · Active · Backlog                                              |
| My issues    | Assigned · Created · Subscribed · Activity [docs]                          |
| Projects     | All projects (plus custom saved views)                                     |
| Project page | Overview · Issues (+ custom issue view tabs) [docs]; Updates tab when used |
| Inbox        | Priority · Other [docs] (clone: one list is enough)                        |

"Active" = issues in `unstarted` + `started` states. "Backlog" = issues in `backlog` states.
"All issues" = everything not archived (completed/canceled shown at the end).

---

## 2. Issue list (list layout)

### 2.1 Group header

[observed] 36px row, surface-tinted background (slightly lighter than bg), sticky while
scrolling [docs: group headers stay sticky]. Content left to right:

`[chevron collapse] [StatusIcon] Status name  [count in muted]  ..............  [+ add issue]`

- The count is the number of issues (or total estimate; click to switch) [docs].
- `+` on the right opens the create-issue modal with that group's value pre-filled.
- Empty groups are hidden unless "Show empty groups" is on [docs].
- Default group order for status grouping: Triage, Backlog, Todo (unstarted), In Progress
  (started), In Review (started), Done (completed), Canceled (canceled) — i.e. in workflow
  order. [observed] Linear lists started groups first in "Active"; with ordering by status,
  active work comes first, then completed and canceled [docs].

### 2.2 Row anatomy

Row height 36px [observed], 1px bottom border (`--color-border`, very subtle), hover =
surface background, highlighted (keyboard focus) row = surface background + accent-ish left
inset. Left to right [observed]:

| #   | Element           | Notes                                                                                                                                                                  |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Checkbox          | Hidden. Shows on hover near the left edge, or when any row is selected [docs]                                                                                          |
| 1   | **Priority icon** | 16px, muted. Clickable → priority menu                                                                                                                                 |
| 2   | **Identifier**    | `ENG-123`, muted, monospace-ish tabular numbers, fixed width (~60-70px)                                                                                                |
| 3   | **Status icon**   | 14px circle icon in the state color. Clickable → status menu                                                                                                           |
| 4   | **Title**         | Primary text, single line, truncate with ellipsis, takes remaining space. Sub-issues show parent title in muted text: `Parent title › ` (when "show sub-issues" is on) |
| 5   | Sub-issue count   | Small chip `◔ 2/5` when the issue has sub-issues                                                                                                                       |
| —   | flexible spacer   |                                                                                                                                                                        |
| 6   | **Labels**        | Pills: 1px border, 6px colored dot + name, 12px text, rounded-full. Max 2-3 then `+N`                                                                                  |
| 7   | **Project**       | Chip with project icon (colored) + project name, 12px                                                                                                                  |
| 8   | Cycle             | Chip with cycle icon + `Cycle 12` (optional property)                                                                                                                  |
| 9   | Estimate          | Small chip with estimate number (optional)                                                                                                                             |
| 10  | **Due date**      | Chip with calendar icon + `Oct 14`. Overdue: red text (`#eb5757`); due soon: orange                                                                                    |
| 11  | **Assignee**      | 20px round avatar; unassigned = dashed circle person icon                                                                                                              |
| 12  | **Created date**  | Muted 12px `Oct 3` (format `MMM D`; `MMM D, YYYY` if not this year), right-aligned, fixed width                                                                        |

Display-property toggles control 6-12 (and 1-3). Default visible set [observed]: Priority,
ID, Status, Labels, Project, Due date, Assignee, Created. Hidden by default: Cycle, Estimate,
Milestone, Updated, Links.

Row interactions:

- Click row → open issue page. `Enter` opens the highlighted row.
- Hover a row + press a property key (`S`, `P`, `A`, `L`, ...) edits that issue [docs/observed].
- Right-click → context menu with: Status ›, Assignee ›, Priority ›, Labels ›, Project ›,
  Cycle ›, Due date ›, Set parent, Copy ID / URL / branch name, Subscribe, Delete.
- Drag a row into another group → the issue takes that group's value [docs].
- `Space` (press or hold) = Peek (preview panel) [docs].

### 2.3 Bulk selection bar

[docs] When one or more issues are selected, a floating bar appears **at the bottom center**
of the view: `N selected` + `×` (clear) + action buttons (Status, Priority, Assignee, Labels,
Project, ... , Delete). `Esc` clears the selection.

---

## 3. Board (kanban) layout

Toggle list/board: `Cmd/Ctrl+B` [docs]. Columns = groups (status by default). Sub-grouping
creates horizontal swim lanes [docs]. Manual ordering is the default for boards [docs].

**Column** [observed]: ~340px wide, 8-12px gap, no column background (bg color). Header:
`[StatusIcon] Status name  count  ........ [...] [+]`. Hidden/empty columns collapse into a
"Hidden columns" strip at the right.

**Card** anatomy [observed], surface background (`#1c1d1f`), 1px border, 8px radius, 10-12px
padding, hover = slightly lighter border:

```
+-----------------------------------------+
| ENG-123                         (avatar) |   identifier (muted, 12px) · assignee 20px top-right
| [status] Card title, wraps up to 2-3    |   status icon inline before the title, 13px text
| lines                                   |
| [pri] [label • Bug] [project] [Oct 14]  |   property chips row (only enabled props)
+-----------------------------------------+
```

- Chips row order: priority icon chip, labels, project, cycle, estimate, due date, then
  created date (muted) if enabled.
- Drag between columns changes status; drag inside a column reorders (manual order).
- Drop target: a 2px accent line, or a placeholder with dashed border.
- Column `+` creates an issue with that status.

---

## 4. Issue detail page

Route: `/<workspace>/issue/ENG-123/<slug>` [observed]. Two columns: main (scroll) and a
right properties panel (~260-300px, toggle `Cmd/Ctrl+I`).

### 4.1 Header bar [observed]

`Engineering › ENG-123` breadcrumb (team icon + team name, then identifier; sub-issues show
`Engineering › ENG-100 › ENG-123`), then on the right: star (favorite), "..." menu, `↑ ↓`
buttons with "3 / 47" position to move to previous/next issue in the source list, and
"Copy link"/"Copy ID" icons.

### 4.2 Main column (top to bottom)

1. **Parent link** (only for sub-issues) [observed]: small muted line `↳ Sub-issue of` +
   status icon + `ENG-100 Parent title`. Shortcut to open parent `Cmd/Ctrl+Shift+↑` [observed].
2. **Title**: 24px, semi-bold, inline-editable (no border, looks like text). Placeholder
   `Issue title`.
3. **Description**: rich-text editor, 15px, inline-editable, placeholder
   `Add description…`. Autosaves. Supports `/` slash menu, markdown shortcuts, `@` mentions.
4. **Reactions / attachments row** [observed]: small emoji + paperclip icons under the
   description.
5. **Sub-issues** [docs: "+ Add sub-issues" button below the description]:
   - Header: `Sub-issues` + progress `2/5` (with small progress-circle icon) + display
     options + `+`.
   - Each sub-issue is a compact list row (priority, ID, status, title, assignee).
   - `Cmd/Ctrl+Shift+O` opens the inline sub-issue editor [docs].
6. **Relations** (if any) [observed]: grouped lines "Blocked by", "Blocking", "Related to",
   "Duplicate of", each as compact issue rows.
7. **Activity** [observed]:
   - Header `Activity` + on the right "Unsubscribe/Subscribe" and subscriber avatars.
   - Timeline: system events as one muted line with a small icon/avatar:
     `Agustin created the issue · 2d ago`,
     `Agustin changed status from Todo to In Progress · 1h ago`,
     `Agustin set priority to High`, `added label Bug`, `assigned to Ana`,
     `moved from Cycle 3 to Cycle 4`.
   - Comments are cards (surface background, border, 8px radius): avatar + name + relative
     time, body, hover actions (reaction, "..." → Edit / Delete / Copy link).
   - Similar consecutive events are folded ("show N more").
8. **Comment composer** at the bottom: surface box, placeholder `Leave a comment…`, attach
   icon, submit button (up arrow / "Comment"), `Cmd/Ctrl+Enter` submits.

### 4.3 Right properties panel

Order [observed]:

1. Top: small action icons (copy link, copy ID, copy branch name).
2. **Status** (icon + name)
3. **Priority** (icon + name)
4. **Assignee** (avatar + name, or `Assign`)
5. **Labels** (chips; `+ Add label`)
6. **Cycle** (`Add to cycle`)
7. **Project** (`Add to project`) and **Milestone** under it when the project has milestones
8. **Estimate** (if estimates are on for the team)
9. **Due date** (`Set due date`)
10. Separator, then **Created** / **Updated** info is shown in activity, not here [observed].

Each property is a 32px row: label column is optional in Linear (it shows only the value
chip); for the clone use `Label` (muted, 90px) + value chip. Empty values show muted
placeholder text with a `+`. Clicking opens the same dropdown menu as the list shortcuts.

---

## 5. Create-issue modal

Opens with `C` anywhere, or the sidebar new-issue button [docs]. `V` opens it in full-screen
mode [observed]. Centered, ~720px wide, surface background, 12px radius, big shadow, dark
overlay behind.

Anatomy, top to bottom [observed]:

```
+--------------------------------------------------------------------+
| [E ENG v]  ›  New issue                              [expand] [×] |   1. header
|                                                                    |
| Issue title                                                        |   2. title (18-20px)
| Add description…                                                   |   3. description (rich)
|                                                                    |
| [◌ Backlog] [--- Priority] [◯ Assignee] [⊕ Labels] [▢ Project]    |   4. property chips row
| [⟳ Cycle] [▲ Estimate] [📅 Due date] [...]                          |
|--------------------------------------------------------------------|
| [📎]                                    [◯— Create more] [Create issue] |   5. footer
+--------------------------------------------------------------------+
```

1. **Header**: **team chip** (team icon + team key, dropdown to change team) › `New issue`.
   Right: expand (full screen) and close `×`. Sub-issue creation shows `New sub-issue` and a
   parent chip.
2. **Title**: borderless input, placeholder `Issue title`, autofocus. Required [docs].
3. **Description**: borderless rich-text area, placeholder `Add description…`.
4. **Property chips row**: small bordered pill buttons (24-28px high, 12px text, icon +
   label). Default order: Status (default state of the team, e.g. `Backlog`/`Todo`),
   Priority, Assignee, Labels, Project, (Cycle, Estimate if on), Due date, then `...` for
   more (Parent, Milestone). Empty chips show the property name in muted text; filled chips
   show the value. Each chip opens a searchable dropdown; the same single-key shortcuts work
   inside the modal when focus is not in a text field.
5. **Footer**: attachment icon on the left. Right: **"Create more"** toggle (small switch +
   label; when on, the modal stays open and clears title/description after create) and the
   primary **`Create issue`** button (accent). `Cmd/Ctrl+Enter` submits [docs].

Behavior [docs]: `Esc` / close asks to save a **draft** if content was typed ("Save as
draft?" — Discard / Save). After create: toast at bottom-right `Created issue ENG-124` with a
"View issue" link [observed]. Opening from a group `+` pre-fills that group's value.

---

## 6. Filter and display options

### 6.1 Filter menu (`F`)

[docs + observed]

- Click **Filter** (or press `F`) → a command-style dropdown with a search input and the
  list of fields: Status, Assignee, Creator (Created by), Priority, Labels, Project, Cycle,
  Estimate, Due date, Created date, Updated date, Subscriber, Relations, Content (text), Team.
- Pick a field → second level lists the values with checkboxes, icons and counts. Multi-select
  is allowed; `Enter` toggles.
- Each applied filter is a **chip** in the filter row:
  `[Status] [is ▾] [In Progress, Todo] [×]` — three clickable segments (field, operator,
  value) + remove.
- Operators [docs]: `is` / `is not` (one value), `is any of` / `is not` (several values),
  labels: `includes any of` / `includes all of` / `does not include`, dates: `before` /
  `after` / relative ("in the next 2 weeks", "overdue").
- Different fields combine with AND; values inside one chip combine with OR [observed].
- `Shift+F` clears the last filter, `Alt+Shift+F` clears all [observed].
- Filters are kept in the URL [docs] (clone: put filters, grouping, ordering, layout in URL
  search params, per `FEATURES.md` ISS-5).
- Text search in a view: `Cmd/Ctrl+F` focuses a quick search input in the header [docs:
  inbox; observed: views].

### 6.2 Display options (sliders button)

[docs + observed] A popover (~320px). Top to bottom:

1. **Layout**: segmented control `List | Board` (icons + labels). `Cmd/Ctrl+B`.
2. **Grouping** select: Status, Assignee, Project, Priority, Cycle, Label, Parent issue,
   Team, No grouping [docs].
3. **Sub-grouping** select (same options; board shows them as swim lanes) [docs].
4. **Ordering** select: Manual, Status, Priority, Last created, Last updated, Due date,
   Link count [docs] — plus a reverse-direction toggle button (disabled for Manual) [docs].
5. **Completed issues** [observed]: `All` / `Past day` / `Past week` / `Past month` / `None`.
6. **Show sub-issues** toggle [docs]. **Show empty groups** toggle [docs].
7. **Display properties**: a wrap of small toggle pills [docs]: ID, Status, Assignee,
   Priority, Project, Due date, Milestone, Cycle, Labels, Estimate, Links, Created, Updated.
   On = filled pill, off = muted outline.
8. Footer: `Reset to default` and (on custom views) `Save as default`.

---

## 7. Workflow states, status icons and colors

Status types (Linear API `WorkflowState.type`) [docs/API]: `triage`, `backlog`,
`unstarted`, `started`, `completed`, `canceled` (+ `duplicate`, a canceled-like type).

Default team workflow [observed from Linear API default workspaces; the public docs only say
"We create a default workflow for you"]:

| Order | Name        | Type               | Color (hex)       | Icon (14px)                                     |
| ----- | ----------- | ------------------ | ----------------- | ----------------------------------------------- |
| —     | Triage      | triage             | `#fc7840`         | Orange circle with two opposite arrows          |
| 1     | Backlog     | backlog            | `#bec2c8`         | **Dashed** circle outline (≈ 8 dashes)          |
| 2     | Todo        | unstarted          | `#e2e2e2`         | Empty circle outline (1.5px stroke)             |
| 3     | In Progress | started            | `#f2c94c`         | Circle outline + **half** pie fill (right half) |
| 4     | In Review   | started            | `#0f783c` (green) | Circle outline + **3/4** pie fill               |
| 5     | Done        | completed          | `#5e6ad2`         | Solid filled circle with a white/bg check mark  |
| 6     | Canceled    | canceled           | `#95a2b3`         | Solid filled circle with an ×                   |
| —     | Duplicate   | canceled/duplicate | `#95a2b3`         | Same as Canceled                                |

Rules:

- Started states with more than one entry: pie fill = position within the started group
  (e.g. 1 of 2 = 50%, 2 of 2 = 75%) [observed].
- `FEATURES.md` WS-5 default set = Backlog, Todo, In Progress, In Review, Done, Canceled.
  Seed with the colors above. Default state for new issues: Linear uses **Todo** for team
  members when triage is off, and Backlog for issues created from the Backlog view
  [observed]. Clone: use Todo unless the view pre-fills a status.
- Team settings → Workflow: states grouped by type headers (Triage, Backlog, Unstarted,
  Started, Completed, Canceled), each row: drag handle, colored icon (click → color picker),
  name, description, "..." (Edit, Delete). `+` on each group header adds a state.

---

## 8. Priority

Values (Linear API numbers) [observed/API]: `0` No priority, `1` Urgent, `2` High, `3`
Medium, `4` Low. Menu order: No priority, Urgent, High, Medium, Low (menu shows the number
as a shortcut hint on the right: 0, 1, 2, 3, 4).

Icons (16px) [observed]:

| Priority    | Icon                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No priority | Three short horizontal dashes `- - -` in muted color                                                                                                          |
| Urgent      | Rounded square filled with orange (`#fc7840` / Linear uses an orange-red), white `!` in the middle. In lists it stays colored even when other icons are muted |
| High        | Three vertical bars of rising height (signal-bar style), all 3 filled (muted/foreground color)                                                                |
| Medium      | Same bars, first 2 filled, 3rd dimmed (~30-40% opacity)                                                                                                       |
| Low         | Same bars, first 1 filled, 2nd and 3rd dimmed                                                                                                                 |

Bars: 3px wide, 1px gap, heights 6 / 9 / 12px, bottom-aligned, 1px radius.

---

## 9. Projects

### 9.1 Project statuses [observed; docs say admins can rename/recolor them]

| Name        | Category  | Color     | Icon                                                        |
| ----------- | --------- | --------- | ----------------------------------------------------------- |
| Backlog     | backlog   | `#bec2c8` | dashed circle                                               |
| Planned     | planned   | `#e2e2e2` | empty circle                                                |
| In Progress | started   | `#f2c94c` | half-filled circle                                          |
| Paused      | paused    | `#95a2b3` | circle with pause bars [clone: FEATURES PRJ-1 has `paused`] |
| Completed   | completed | `#5e6ad2` | filled circle + check                                       |
| Canceled    | canceled  | `#95a2b3` | filled circle + ×                                           |

Clone mapping to `FEATURES.md` PRJ-1: planned / started / paused / completed / canceled.

Health (from project updates) [docs]: **On track** (green `#4cb782`), **At risk** (yellow
`#f2c94c`), **Off track** (red `#eb5757`) — colors [observed].

### 9.2 Project list

[observed] Table-like list. Columns: icon + **Name** · **Health** · **Priority** ·
**Lead** (avatar) · **Target date** · **Status** (status icon + progress `%`) · Teams.
Header row with column names in muted 12px. Group by status by default. Progress = completed
issues / total issues (canceled excluded) shown as a small circular progress + `45%`.

### 9.3 Project page

[docs] Header: breadcrumb `Projects › [icon] Project name`, the tabs **Overview** and
**Issues** (+ custom view tabs), "..." menu (Delete, etc.), star, and the details-sidebar
toggle (`Cmd/Ctrl+I`).

**Overview tab** (centered column, max ~720px) [docs]:

1. Large project icon (emoji/icon with color) — click to change.
2. Project name (28px, editable). Placeholder `Project name`.
3. Short summary line, placeholder `Add a short summary…`.
4. **Properties row** (chips): Status, Priority, Lead, Members, Start date → Target date,
   Teams, Labels.
5. **Resources**: links + documents, with a `+` (create document / add link) [docs].
6. Latest **project update** card (health chip + text + author) [docs].
7. **Description** (rich text), placeholder `Add description…` [docs].
8. **Milestones** list below the description [docs]: name, target date, progress; hover ⋮
   menu, drag ⋮⋮ handle to reorder.

**Right details sidebar** [docs: toggle with `Cmd/Ctrl+I`]: Properties (Status, Priority,
Lead, Members, Dates, Teams, Labels), Milestones, **Progress** (graph of scope vs completed
over time + counts: Scope, Started, Completed with %), Activity.

**Issues tab**: the standard issue list/board (sections 2-3) filtered to the project.

---

## 10. Documents

[docs] Documents live inside projects, teams, initiatives, issues and cycles. They use the
same editor as issues. [clone] Also a workspace-level "Documents" sidebar page
(`FEATURES.md` DOC-1).

**Document list** [clone, styled like Linear lists]: rows with document icon (emoji or doc
icon) · Title · Project chip · Author avatar · `Updated 2h ago` (muted, right). Search input
in the header. `+ New document` button.

**Document page** [docs + observed]:

- Header: breadcrumb (`Project name › Document title` or `Documents › title`), right:
  subscribe bell [docs], "..." (Copy link, Move to project, Delete), favorite star.
- Centered column (~720px). Large icon (click to pick emoji/icon), then **Title** (32px,
  placeholder `Untitled`), then a muted meta line: `Last edited by Ana · 5 min ago` [docs:
  shows when and by whom it was last edited].
- Body editor: placeholder `Start writing, or press '/' for commands…` [observed wording may
  differ]. `/` opens the block menu: Heading 1-3, Bulleted list, Numbered list, Checklist,
  Code block, Divider, Quote [docs]. `@` mentions issues/docs/projects (`@ENG-123`) [docs].
- Autosave; realtime in Linear. [clone] show `Saving…` / `Saved` text in the header.
- Inline comments: select text → comment button, `Cmd/Ctrl+Alt+M` [docs].
- Shortcut `O` then `D` opens the document list from a project [docs].

Editor markdown shortcuts [observed]: `#`/`##`/`###` + space headings, `-`/`*` bullet,
`1.` numbered, `[]` checklist, `>` quote, ` ``` ` code block, `---` divider, `**bold**`,
`*italic*`, `~strike~`, `` `code` ``. Formatting keys: `Cmd+B` bold, `Cmd+I` italic,
`Cmd+U` underline, `Cmd+Shift+X` or `Cmd+D` strike, `Cmd+E` / `Cmd+Shift+C` inline code,
`Cmd+K` link, `Cmd+Shift+7/8/9` todo/bullet/numbered list, `Cmd+Shift+\` code block.

---

## 11. Inbox

[docs] Two panes:

- **Left list pane** (~360-400px): header `Inbox` + "..." (Mark all as read, Delete all
  read, Delete all notifications) + display options (`Show snoozed`, `Show unread first`,
  grouping). Tabs Priority / Other [docs; clone may skip].
- Each notification row [observed]: actor avatar (with small event-type icon badge) · line 1:
  `ENG-123 Issue title` (bold when unread) · line 2 (muted): what happened, e.g.
  `Ana commented: "Looks good…"`, `Assigned to you by Ana`, `Status changed to Done` · right:
  relative time `2h` and a blue/accent unread dot.
- **Right pane**: the full issue (same as issue page, sections 4.2-4.3) for the selected
  notification, with inbox actions in its header (Mark read/unread, Snooze, Delete,
  Unsubscribe).
- Empty right pane: inbox icon + `No notifications` / `You're all caught up` [observed].

Shortcuts [docs]: `G` then `I` open; `J/K` or `↑/↓` move; `U` mark read/unread;
`Alt+U` mark all read; `Backspace` delete; `Shift+Backspace` delete all read; `H` snooze;
`Shift+S` unsubscribe; `Cmd/Ctrl+F` search.

Notification types for the clone (`FEATURES.md` UX-3): assigned to you, new comment on a
subscribed issue, status change on a subscribed issue, mention.

---

## 12. Settings

Route `/<ws>/settings/...`. The settings screen **replaces the app sidebar** with a
settings sidebar [observed] that has a `‹ Back to app` link on top (`Esc` also goes back).
Main column centered, max ~640px, page title 24px + muted description, then sections with
bordered rows.

Settings sidebar groups [observed; docs list Workspace > General, Time & region,
Administration for admins]:

1. **Account**: Preferences (theme Light/Dark/System, font size, default home view),
   Profile (avatar, full name, username/display name, email), Notifications, Security &
   access, Connected accounts.
2. **Features** (workspace): Initiatives, Projects (project statuses, updates), Documents
   [observed], Customer requests, Asks, Pulse, AI — not in scope except Projects.
3. **Administration** (admins) [docs]: Workspace (General: logo, name, URL; Delete
   workspace), Teams, Members (invite, roles Admin/Member/Guest), Labels (workspace labels),
   Templates, Integrations, API, Billing, Security, Import/export.
4. **Your teams**: one entry per team → team settings pages: General (name, key, icon),
   Members, Workflow (states, section 7), Labels (team), Cycles, Triage, Estimates,
   Templates.

Clone minimum (`FEATURES.md` WS-3..7, UX-6): Account › Preferences (theme), Account ›
Profile, Administration › Workspace, › Members, › Labels, › Teams; Team › General,
› Members, › Workflow.

Labels settings page [observed]: list rows `[color dot] Name  · N issues · last applied`,
`New label` button, row "..." → Edit / Delete; edit inline with a color swatch picker.
Default labels in a new Linear workspace: **Bug** (`#eb5757`), **Feature** (`#bb87fc`),
**Improvement** (`#4ea7fc`) [observed].

Label palette used by Linear pickers [observed]: `#95a2b3` gray, `#5e6ad2` indigo,
`#26b5ce` cyan, `#4cb782` green, `#f2c94c` yellow, `#f2994a` orange, `#f7c8c1` pink,
`#eb5757` red, `#bb87fc` purple, `#4ea7fc` blue.

---

## 13. Keyboard shortcuts (full list)

`?` opens the searchable shortcut help panel [docs]; it is a right-side sheet titled
`Keyboard shortcuts` with a search input and grouped sections. `Cmd/Ctrl+K` opens the
command menu [docs]. "X then Y" = press X, release, press Y within ~1s. Single-key shortcuts
must not fire while typing in an input/editor.

Sources: Linear docs (pages named in each section) + third-party lists (pie-menu.com,
fastshortcuts.com) [observed]. Where lists disagree, the newer Linear behaviour is used.

### General

| Keys             | Action                                 |
| ---------------- | -------------------------------------- |
| `Cmd/Ctrl+K`     | Command menu [docs]                    |
| `?`              | Keyboard shortcuts help [docs]         |
| `/`              | Search [docs]                          |
| `C`              | Create issue [docs]                    |
| `Alt+C`          | Create issue from template [docs]      |
| `V`              | Create issue in full-screen [observed] |
| `Cmd/Ctrl+Enter` | Save / submit (create issue, comment)  |
| `Esc`            | Close / go back / clear selection      |
| `Cmd/Ctrl+B`     | Toggle list / board [docs]             |
| `Cmd/Ctrl+I`     | Toggle details sidebar [docs]          |
| `[`              | Toggle app sidebar [observed]          |
| `Alt+Shift+Q`    | Log out [observed]                     |
| `Cmd/Ctrl+click` | Open in new tab [docs]                 |

### Navigation (G then …)

| Keys                                 | Action                       |
| ------------------------------------ | ---------------------------- |
| `G` `I`                              | Inbox [docs]                 |
| `G` `M`                              | My issues [docs]             |
| `G` `T`                              | Triage [docs]                |
| `G` `A`                              | Active issues (current team) |
| `G` `B`                              | Backlog                      |
| `G` `E`                              | All issues                   |
| `G` `D`                              | Board                        |
| `G` `C`                              | Cycles                       |
| `G` `V`                              | Current (active) cycle       |
| `G` `W`                              | Upcoming cycle               |
| `G` `P`                              | Projects                     |
| `G` `X`                              | Archived issues              |
| `G` `S`                              | Settings                     |
| `Ctrl+Shift+1..9` / `Cmd+Shift+1..9` | Go to team 1-9               |

### Open (O then …)

| Keys               | Action                      |
| ------------------ | --------------------------- |
| `O` `I`            | Open issue (by search)      |
| `O` `T`            | Open team                   |
| `O` `P`            | Open project                |
| `O` `C`            | Open cycle                  |
| `O` `D`            | Open document (list) [docs] |
| `O` `F`            | Open favorite               |
| `O` `U`            | Open user                   |
| `O` `M`            | Open my profile             |
| `O` `W`            | Switch workspace [docs]     |
| `Cmd/Ctrl+Shift+↑` | Open parent issue           |
| `Cmd/Ctrl+Shift+↓` | Open sub-issue              |

### Lists and selection [docs: select-issues]

| Keys                 | Action                                                  |
| -------------------- | ------------------------------------------------------- |
| `J` / `↓`            | Move down                                               |
| `K` / `↑`            | Move up                                                 |
| `Enter`              | Open highlighted issue                                  |
| `X`                  | Select / deselect highlighted issue                     |
| `Shift+↑/↓`          | Extend selection                                        |
| `Shift+click`        | Select range                                            |
| `Cmd/Ctrl+A`         | Select all                                              |
| `Esc`                | Clear selection                                         |
| `Space` (tap / hold) | Peek preview [docs: peek]                               |
| `Alt+↑/↓`            | Move selected issue up/down (manual order, no grouping) |
| `Alt+Shift+↑/↓`      | Move selected issue to top/bottom                       |

### Issue actions (on hovered/highlighted/selected/open issue)

| Keys                                                 | Action                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `S`                                                  | Change status                                                 |
| `Cmd/Ctrl+Alt+1..9`                                  | Set status by position [observed]                             |
| `P`                                                  | Change priority                                               |
| `0` / `1` / `2` / `3` / `4` inside the priority menu | No priority / Urgent / High / Medium / Low                    |
| `A`                                                  | Assign to …                                                   |
| `I`                                                  | Assign to me                                                  |
| `L`                                                  | Add/change labels                                             |
| `Shift+L`                                            | Remove label                                                  |
| `Shift+P`                                            | Add to project                                                |
| `Shift+C`                                            | Add to cycle                                                  |
| `Shift+E`                                            | Set estimate                                                  |
| `Shift+D`                                            | Set due date [observed: newer lists; older lists say `Cmd+D`] |
| `Cmd/Ctrl+Shift+D`                                   | Remove due date                                               |
| `R`                                                  | Rename (edit title)                                           |
| `E`                                                  | Edit issue (focus description)                                |
| `Cmd/Ctrl+M`                                         | Comment                                                       |
| `Shift+S`                                            | Subscribe / unsubscribe                                       |
| `Cmd/Ctrl+Shift+S`                                   | Manage subscribers                                            |
| `Cmd/Ctrl+Shift+O`                                   | Create sub-issue [docs]                                       |
| `Cmd/Ctrl+Shift+M`                                   | Move to another team                                          |
| `M` `B`                                              | Mark as blocked by                                            |
| `M` `X`                                              | Mark as blocking                                              |
| `M` `R`                                              | Add related issue                                             |
| `M` `M`                                              | Mark as duplicate / merge into [docs: triage]                 |
| `Cmd/Ctrl+.`                                         | Copy issue ID                                                 |
| `Cmd/Ctrl+Shift+.`                                   | Copy git branch name                                          |
| `Cmd/Ctrl+Shift+,`                                   | Copy issue URL                                                |
| `Cmd/Ctrl+L`                                         | Add link                                                      |
| `Cmd/Ctrl+Backspace`                                 | Delete issue                                                  |
| `#`                                                  | Archive issue [observed]                                      |
| `H`                                                  | Snooze (inbox/triage) [docs]                                  |

### Filters

| Keys          | Action                              |
| ------------- | ----------------------------------- |
| `F`           | Open filter menu [docs]             |
| `Shift+F`     | Clear last filter                   |
| `Alt+Shift+F` | Clear all filters                   |
| `Cmd/Ctrl+F`  | Quick search in view / inbox [docs] |

### Triage [docs] (not in scope)

`1` Accept · `2` Decline · `3` / `M` `M` Mark duplicate · `H` Snooze.

### Inbox [docs]

`U` read/unread · `Alt+U` all read · `Backspace` delete · `Shift+Backspace` delete all read ·
`H` snooze.

### Editor

See section 10 (markdown + formatting keys). `Cmd/Ctrl+Z` undo, `Cmd/Ctrl+Shift+Z` redo,
`Cmd/Ctrl+Shift+A` attach file, `Cmd/Ctrl+Alt+M` inline comment (documents).

---

## 14. Command menu (`Cmd/Ctrl+K`)

[docs + observed] Centered modal, ~640px, top third of the screen. Search input
(placeholder `Type a command or search…`). When an issue context exists, a chip on top shows
`ENG-123 Issue title` (the target). Results are grouped: issue actions (Change status…,
Assign to…, Change priority…, Add labels…), then Navigation (Go to inbox `G I`, Go to my
issues `G M`, …), then Create (Create new issue `C`, Create new project, Create document),
then search results (issues, projects, documents). Each row: icon, label, shortcut keys on
the right as small `kbd` boxes. `↑/↓` move, `Enter` run, `Esc` close, `Backspace` on empty
input goes back one level. Moving through items previews them (peek) [docs].

---

## 15. Microcopy and empty states

Exact Linear wording is marked [observed]; wording marked [clone] is a safe Linear-style
choice. Tone: short, calm, sentence case, no exclamation marks, ellipsis `…` on placeholders
and on actions that open a menu.

| Place                                | Copy                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create modal title placeholder       | `Issue title` [observed]                                                                                                                                                                                                                                                                         |
| Create modal description placeholder | `Add description…` [observed]                                                                                                                                                                                                                                                                    |
| Create modal button / toggle         | `Create issue` · `Create more` [observed]                                                                                                                                                                                                                                                        |
| Draft prompt                         | `Save issue as draft?` — `Discard` · `Save draft` [clone]                                                                                                                                                                                                                                        |
| Toast after create                   | `Created issue ENG-124` + `View issue` [observed]                                                                                                                                                                                                                                                |
| Comment placeholder                  | `Leave a comment…` [observed]                                                                                                                                                                                                                                                                    |
| Sub-issue button                     | `+ Add sub-issues` [docs]                                                                                                                                                                                                                                                                        |
| Unassigned                           | `No assignee` / `Assign` (in panel) [observed]                                                                                                                                                                                                                                                   |
| No priority                          | `No priority` [observed]                                                                                                                                                                                                                                                                         |
| Empty labels in panel                | `Add label` [observed]                                                                                                                                                                                                                                                                           |
| No project                           | `Add to project` [observed]                                                                                                                                                                                                                                                                      |
| No due date                          | `Set due date` [clone]                                                                                                                                                                                                                                                                           |
| Search placeholder                   | `Search…` / `Search issues, projects and documents…` [clone]                                                                                                                                                                                                                                     |
| Filter search placeholder            | `Filter…` [observed]                                                                                                                                                                                                                                                                             |
| Empty team issues view               | Illustration + `No issues` + `Create new issue` button with `C` hint [clone]                                                                                                                                                                                                                     |
| Empty filtered view                  | `No issues match the current filters` + `Clear filters` [clone]                                                                                                                                                                                                                                  |
| Empty My issues (Assigned)           | `No issues assigned to you` + `Issues assigned to you will show up here.` [clone]                                                                                                                                                                                                                |
| Empty inbox                          | `No notifications` · `You're all caught up` [observed]                                                                                                                                                                                                                                           |
| Empty projects                       | `No projects` + `Projects are larger units of work with a clear outcome.` + `Create new project` [clone, Linear-style]                                                                                                                                                                           |
| Empty documents                      | `No documents yet` + `New document` [clone]                                                                                                                                                                                                                                                      |
| Empty cycles                         | `No cycles` + `Cycles help your team work in focused periods.` + `Create cycle` [clone]                                                                                                                                                                                                          |
| Document title placeholder           | `Untitled` [observed]                                                                                                                                                                                                                                                                            |
| Document saved state                 | `Saving…` / `Saved` [clone]                                                                                                                                                                                                                                                                      |
| Delete issue confirm                 | `Delete issue ENG-12?` — `This can't be undone.` — `Cancel` · `Delete` (red) [clone]                                                                                                                                                                                                             |
| Activity lines                       | `{actor} created the issue` · `{actor} changed status from {A} to {B}` · `{actor} set priority to {P}` · `{actor} assigned the issue to {user}` · `{actor} added label {L}` · `{actor} removed label {L}` · `{actor} moved to project {P}` · `{actor} set due date to {date}` [observed pattern] |
| Relative time                        | `just now`, `5 min ago`, `2h ago`, `yesterday`, `Oct 3` [observed]                                                                                                                                                                                                                               |
| Selection bar                        | `{n} selected` [observed]                                                                                                                                                                                                                                                                        |

---

## 16. Motion and density rules

[observed]

- Menus and popovers: fade + 2-4px slide, 120-150ms, ease-out. No bounce.
- Modals: fade + scale from 0.98, 150ms.
- Hover states change background only (no movement).
- Focus ring: 1-2px accent (`#5e6ad2`) outline, only for keyboard focus (`:focus-visible`).
- All dropdowns are **searchable command lists**: type to filter, `↑/↓` + `Enter`, current
  value marked with a check on the right, each option shows its icon on the left and the
  shortcut number on the right when there is one.
- Tooltips: 500ms delay, surface background, show the action name + its shortcut in `kbd`
  boxes (`Change status  S`).
- Dense: 13px text, 36px rows, 4/8px spacing grid. No large cards on list pages.

---

## Sources

- linear.app/docs/display-options — layouts, grouping, ordering, display properties
- linear.app/docs/filters — filter fields, operators, `F` shortcut
- linear.app/docs/creating-issues — create issue flow, drafts, `C`, `Alt+C`
- linear.app/docs/select-issues — selection and bulk-action shortcuts
- linear.app/docs/parent-and-sub-issues — sub-issue UI and shortcuts
- linear.app/docs/peek — peek behaviour
- linear.app/docs/inbox — inbox layout and shortcuts
- linear.app/docs/my-issues — My issues tabs and Focus grouping
- linear.app/docs/projects, /project-milestones, /project-status,
  /initiative-and-project-updates — project page, milestones, statuses, health
- linear.app/docs/documents — documents editor, comments, shortcuts
- linear.app/docs/use-cycles — cycles UI
- linear.app/docs/triage — triage actions and shortcuts
- linear.app/docs/workspaces — settings structure
- linear.app/docs/conceptual-model — workspace / team / issue / project / cycle model
- linear.app/enablement/guides/navigating-linear — sidebar order, `G I`, `G M`, `?`, `/`
- linear.app/changelog/2021-03-25-keyboard-shortcuts-help — `?` help panel
- pie-menu.com/shortcuts/linear, fastshortcuts.com/shortcuts/linear — third-party shortcut
  lists [observed]
