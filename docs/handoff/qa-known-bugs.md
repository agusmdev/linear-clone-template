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

## Known and accepted (not bugs to re-report)

- A tab left open after another admin removes you shows "Workspace <id> not found".
- The last completed status of a team can be deleted.
- Deleting the last cycle frees its number for reuse.
- "Move unfinished" can target a past cycle when the next cycle is also past.
- The first Playwright test on a cold Vite dev server can render a blank page in slow containers.
