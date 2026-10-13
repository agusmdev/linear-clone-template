# Known QA bugs

Bugs found by earlier QA rounds. Do not re-report one unless it still reproduces on `main`.

## Round 1 (all fixed)

- long workspace name overlaps sidebar icons
- 'Workspace not found' had no navigation
- duplicate-email raw backend message
- login error revealed account existence
- whitespace-only display name accepted
- Enter in ColorPicker hex submitted outer form
- light theme small primary/destructive buttons dark text
- duplicate workflow state names
- light theme Todo icon invisible
- stale queries 404 after team delete/workspace leave
- search box kept text after Clear filters
- My issues filter carried to tab that hides it
- LIKE wildcards in issue search
- Escape did not clear selection
- bulk bar covered last row
- double submit duplicate issues + long title broke modal
- Escape in slash menu closed modal / Cmd+Enter stray break
- Cmd+K async results not selectable with Enter
- titles could contain newlines
- deleting issue refetched 6 times
- whitespace-only titles/comments accepted
- document edits lost before reload
- sidebar favorite kept old/deleted document
- workspace URL key accepted reserved names
- focus stuck on S/P/A picker so J/K broke
- Create more lost title focus
- favorites kept deleted issue
- relation/sub-issue changes missing from activity
- document search matched raw HTML
- Saved shown while unsaved
- mobile project chip overlapped breadcrumbs
- no UI for team documents (now /team/KEY/documents)
- typed project date saved wrong year
- target date before start date allowed
- Filter menu chip popover closed immediately.

## Round 2 (all fixed)

- auth: onboarding header overflowed at 390px and pushed "Log out" off-screen
- settings: API accepted blank / padded workspace, team, workflow state and label names
- settings: Esc in a label or status editor row left Settings when focus was on the row's buttons
- settings: changing the workspace URL refetched the old URL key (404)
- issues-list: manual drag-reorder did nothing in views that mix teams (tied sort_order)
- issues-list: "+" on a priority group or board column did not prefill the priority
- create-issue: parent picker only listed the 100 most recent issues (now searches the server)
- create-issue: long assignee name wrapped inside its chip; "Create more" track invisible in dark theme
- issue-detail: description typed just before a reload was lost (keepalive); same for the project description
- documents: lists showed only the first 100 documents
- documents: API accepted blank and multi-line document titles; long titles were cut off
- documents: a document opened under another workspace's URL loaded in the wrong workspace
- projects-cycles: renamed/deleted favorite project stayed stale in the sidebar; delete refetched the project (404)
- projects-cycles: New issue on a past cycle's page showed an empty Cycle chip
- projects-cycles: API accepted blank project names; blank cycle names were stored as-is
- inbox-search: inbox unusable at phone width (preview pane hidden)
- inbox-search: status_changed notifications showed the current status instead of the one at the time

## Round 3 (all fixed)

- auth: auth state not synced across tabs (sign-in as another user / sign-out in another tab)
- auth: onboarding "open one of your workspaces" row hid the name at 390px
- settings: sidebar "Your teams" listed teams the user never joined (now `?joined=true`)
- settings: team key change / team delete left stale favorites; display name change not shown until reload
- settings: Teams list cut names at 390px; API accepted line breaks in names
- issues-list: identifier search ignored the team key (DES-2 matched ENG-2)
- issues-list: bulk action bar wider than a phone screen; no row hover/focus or drop highlight in light theme
- create-issue: command palette opened stale search results from an earlier query
- create-issue: global shortcuts (C, G S, ?, I/S/P) fired behind open modals and menus
- issue-detail: relation type menu not keyboard-usable; hover-only controls invisible on touch
- issue-detail: identifier cut to "EN…" and parent link wrapping at 390px; sub-issue input had no length limit
- documents: "UTF-8", "ISO-9001" etc. became issue links to 404 pages
- documents: renamed/deleted project stayed stale on its documents; New document did not focus the title
- documents: list showed the last editor instead of the author (DOC-1)
- projects-cycles: long project name pushed the issue title out of the row
- projects-cycles: C / palette "Create new issue" did not prefill the page's project or cycle
- projects-cycles: double-click on Delete / Create cycle showed false errors; long cycle names hid "Cycle N" at 390px
- projects-cycles: removed project lead showed as none on the project page
- inbox-search: comment notifications did not show the comment
- inbox-search: mark all read also counted archived notifications
- e2e: the first test on a cold Vite server rendered a blank page (now a warm-up project runs first)

## Round 4 (all fixed)

- auth: sign-in and "/" opened the oldest workspace instead of the last used one
- settings: Delete status dialog options wrapped icon and name; Delete workspace prompt split in 3 lines; reorder buttons invisible on touch
- issues-list: drag to the top/bottom of a column or into an empty column could tie sort_order and land in the wrong place
- issue-detail: long label overflowed its chip; inline sub-issue ignored the parent's project and cycle; long activity values overflowed
- documents: search page and Cmd+K showed a generic glyph instead of the document's emoji
- projects-cycles: a project URL under another workspace loaded there; inline project name had no length limit
- inbox-search: search matched HTML markup in issue/project descriptions (also the issues-list filter); queries over 200 chars failed
- create-issue: three quick Cmd+Enter could create a duplicate while the dialog was closing

## Known and accepted (not bugs to re-report)

- A tab left open after another admin removes you shows "Workspace <id> not found".
- The last completed status of a team can be deleted.
- Deleting the last cycle frees its number for reuse.
- "Move unfinished" can target a past cycle when the next cycle is also past.
- An anonymous visit to `/my-issues` (no workspace in the URL) ends at `/login?redirect=/my-issues/my-issues`.
- Label clicks less than ~150 ms apart in the issue panel can drop one.
- Very long passwords and names up to the schema limits are accepted.
- Clicking Move down again before the previous workflow-state move saved can reorder wrongly.
- Pressing Enter several times within one frame in the inline sub-issue input can create duplicates.
- An issue already related to another issue cannot get a second relation type with that issue.
- The label picker has no "create label" option (labels are managed in Settings).
