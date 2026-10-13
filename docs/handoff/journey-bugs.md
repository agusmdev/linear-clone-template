# Journey QA bugs (cross-area)

Found by `linear-journey-qa` (6 end-to-end user journeys on the Docker stack), each confirmed by at least 2 of 3 independent verifiers (reproduce, code, skeptic). Bug J4 (multi-word issue-list search) was already fixed on `main` in QA round 8.

## Group `keyboard`

### J5: J/K/S/P/A stop working in the issue list after closing the '?' shortcuts help, the Ctrl+K palette or the C create-issue modal (focus goes to <body>) (minor)

- **Steps:** 1. Open /<ws>/team/ENG/issues (or My issues). The list has focus.
2. Press J twice. The 2nd row is highlighted.
3. Press '?' and then Escape. Or press Ctrl+K and then Escape. Or press C, type a title and press Ctrl+Enter (or Escape).
4. Press J, then S.
- **Expected:** Focus goes back to the issue list. J moves to the next row and S opens the status picker, as already happens after the context menu and the delete dialog (round-5 fix).
- **Actual:** document.activeElement is BODY after each of these overlays closes. J does nothing (the highlight stays on the same row) and S opens no picker until the user clicks the list again. Reproduced on the team list (all 3 overlays) and on My issues ('?' and C plus create). A similar thing happens after a bulk-bar action: focus stays on the bar's 'Priority' or 'Status' button and J does nothing.
- **Suspected files:** frontend/src/components/command/ShortcutsHelpDialog.tsx, frontend/src/components/command/CommandPalette.tsx, frontend/src/components/issues/CreateIssueDialog.tsx (no onCloseAutoFocus and no trigger to return focus to); frontend/src/components/issues/IssuesView.tsx (list keyboard handling only works while the listbox has DOM focus)

### J11: After J/K on an issue list, "G then P" and "G then S" open the row's priority/status picker instead of going to Projects/Settings (major)

- **Steps:** 1. Sign in, open Engineering > Issues (/<ws>/team/ENG/issues) or My issues (/<ws>/my-issues), light theme, at least one issue.
2. Press J to highlight a row. This is the normal keyboard way to move through the list.
3. Press G, then P (or G, then S) within 1 s.
Reproduced 4 times: team list and My issues, each with P and S, with two users (Paula and a fresh user Rita).
- **Expected:** G then P goes to /<ws>/projects and G then S goes to /<ws>/settings. This is what the ? shortcuts dialog lists, and it already works on the same page when no row is highlighted, and on the issue page.
- **Actual:** The URL does not change. The "Set priority to…" picker (for P) or the "Change status…" picker (for S) opens on the highlighted row (screenshots s17-01, s17-04, s24-01, s24-02). If the user keeps typing, they can change that issue by accident. G then D, I and M still navigate. Cause: the list's own onKeyDown handles the second key (P/S) as a picker key and calls preventDefault(). ShortcutsProvider then returns early on event.defaultPrevented, so the pending 'g p' / 'g s' sequence never completes.
- **Suspected files:** frontend/src/components/issues/IssuesView.tsx (onKeyDown, PICKER_KEYS); frontend/src/components/command/ShortcutsProvider.tsx (defaultPrevented early return / sequence buffer)

### J12: Issue list stops answering J/K/Enter/S/P/A after the Create issue dialog, the Cmd/Ctrl+K palette or the ? help dialog closes (major)

- **Steps:** 1. Open /<ws>/team/ENG/issues (or My issues). The list gets focus on load.
2. Press J. The first row is highlighted.
3. Do one of these: (a) press C, then Esc (or type a title and press Ctrl+Enter to create it); (b) press Ctrl+K, then Esc; (c) press ?, then Esc.
4. Press J again (twice).
Reproduced for all three dialogs, with two users. This is different from the fixed Round 5 bug, which covered the context menu and the delete dialog.
- **Expected:** Focus goes back to the issue list, so J/K move the highlight and Enter/S/P/A/X act on it. This is how Linear works after a modal closes.
- **Actual:** document.activeElement is <body>. J/K do nothing and the highlight stays on the same row (e.g. 'ENG-1 Alpha' before and after J J). Enter/S/P/A/X also do nothing. A keyboard-only user has to click the list to get it back. Global shortcuts (C, G I, …) still work.
- **Suspected files:** frontend/src/components/issues/IssuesView.tsx (list is auto-focused only on load); frontend/src/components/issues/CreateIssueDialog.tsx; frontend/src/components/command/CommandPalette.tsx; frontend/src/components/command/ShortcutsHelpDialog.tsx (no onCloseAutoFocus back to the list)

### J13: On Windows/Linux, pressing Ctrl+K again does not close the command palette; it highlights "Log out", so Enter signs the user out (minor)

- **Steps:** 1. On a non-Mac browser (Linux Chromium here; navigator.platform 'Linux x86_64'), open any workspace page, e.g. /<ws>/issue/ENG-1.
2. Press Ctrl+K. The command menu opens.
3. Press Ctrl+K again to close it (the shortcut is registered as a toggle: useShortcut('mod+k', () => setOpen(o => !o), { allowInInputs: true })).
4. Press Enter.
Reproduced 3 times, with two users.
- **Expected:** The second Ctrl+K closes the palette, as Cmd+K does on Mac and as the toggle code intends.
- **Actual:** The palette stays open. cmdk's built-in vim binding (Ctrl+K = move up, with `loop`) consumes the key, so the highlight wraps to the last item, "Log out" (screenshots s18-01, s24-03). Pressing Enter then logs the user out and lands on /login (s24-04).
- **Suspected files:** frontend/src/components/command/CommandPalette.tsx (<Command ... loop> uses cmdk's default vimBindings); frontend/src/components/WorkspaceCommands.tsx (mod+k toggle)

### J14: Esc does nothing on an issue opened from the list, although the ? shortcuts dialog lists Esc as "Close / go back" (minor)

- **Steps:** 1. Open /<ws>/team/ENG/issues.
2. Press J, then Enter. The issue page opens (e.g. /<ws>/issue/ENG-1).
3. Press Esc, with nothing focused and no popover open.
Reproduced twice (Paula on ENG-3 and ENG-1; fresh user Rita on ENG-1).
- **Expected:** Esc goes back to the list the issue was opened from, as in Linear and as the General section of the ? dialog says ('Esc  Close / go back'). A keyboard-only user can then keep moving with J/K.
- **Actual:** The URL stays /<ws>/issue/ENG-1 and nothing happens. Only the Settings layout has an Esc handler. There is no G-sequence for team issues either, so the keyboard user has to open Cmd+K and run 'Go to Engineering issues' to get back.
- **Suspected files:** frontend/src/routes/_authed/$workspaceKey/issue/$identifier.tsx (no Escape shortcut); frontend/src/components/WorkspaceCommands.tsx (SHORTCUT_HELP 'esc' entry)

## Group `create-defaults`

### J0: New issue preselects a team the user has not joined (the first team in the workspace, alphabetically), so issues land in the wrong team (major)

- **Steps:** 1. Founder registers in the UI and creates a workspace. In Settings > Teams > Engineering, renames the team to 'Product' with key 'PRD', then creates a second team 'Design' (key DES).
2. Register a teammate in a second browser context. The founder invites the teammate in Settings > Members.
3. The teammate opens Settings > Teams, clicks 'Join Product' only, then 'Back to app'. The sidebar's 'Your teams' now lists only Product.
4. On My issues, the teammate clicks the sidebar 'Compose issue' button, or presses C, or uses Cmd+K 'Create new issue', or uses Compose from the Inbox.
5. The teammate types a title and clicks Create issue.
- **Expected:** The modal preselects one of the teammate's own teams (Product, the only team they joined), and the issue is filed there.
- **Actual:** The team chip says 'DES' (aria-label 'Team: Design'), a team the teammate never joined, so the issue is filed in Design. Reproduced with fresh UI-registered users in 2 new workspaces ('preselected team: Team: Design' both times), and in the main journey workspace with 2 more users. Carol and Dave were each in only 'UX Design', yet the modal preselected 'Team: Product' from My issues (C and Compose), from the Inbox and from Cmd+K. Carol's issue 'Filed by carol from inbox' was created as PRD-3 in Product. The API confirms this: GET /workspaces/{ws}/issues/by-identifier/PT-3 (after a key rename) returns team_id = Product, while GET /workspaces/{ws}/teams?joined=true for Carol returns only [('DSN','UX Design')]. The team picker in the modal also lists every workspace team, not only the user's teams. Outside a /team/KEY page, the default is always the alphabetically first team of the workspace.
- **Suspected files:** frontend/src/components/issues/CreateIssueHost.tsx (defaultTeamId falls back to ws.teams[0], which comes from all workspace teams, not the user's joined teams); frontend/src/components/issues/IssuesView.tsx (addInGroup also falls back to scopeTeamIds[0] = first workspace team on My issues)

### J6: Pressing C on My issues > Assigned creates an unassigned issue that does not appear in the view (the 'New issue (C)' button assigns you) (minor)

- **Steps:** 1. Open /<ws>/my-issues (Assigned tab).
2. Hover the header 'New issue' pencil button: its tooltip shows the shortcut 'C'. Click it: the modal's Assignee chip reads 'Assignee: <you>'. Close the modal.
3. Now press C on the same page: the Assignee chip reads 'Unassigned'.
4. Type a title and press Ctrl+Enter.
- **Expected:** C does the same as the button that advertises it: the new issue is assigned to me and shows up in the Assigned list. Team, project and cycle pages already pass their defaults to C.
- **Actual:** The issue is created with no assignee (e.g. DES-7 and DES-8: API assignee null). It does not appear in the Assigned tab the user is looking at, so it looks lost. Reproduced twice.
- **Suspected files:** frontend/src/routes/_authed/$workspaceKey/my-issues.tsx (passes createDefaults to IssuesView and the header button but never calls usePageIssueDefaults, so openCreateIssueHere() used by the C shortcut and the palette gets no assignee)

### J10: Cmd+K 'Create new document' ignores the page you are on: on a project's Documents tab or a team's Documents page the new doc is created with no project and no team, so it does not appear in that list (minor)

- **Steps:** 1. Create a project (e.g. 'Launch') and open /<ws>/project/<id>?tab=documents. Or open the team documents page /<ws>/team/ENG/documents.
2. Press Ctrl/Cmd+K, type 'Create new document' and press Enter.
3. Type a title (e.g. 'Spec from palette') and press Enter.
4. Go back to the project's Documents tab (or the team's Documents page).
5. Check GET /documents/<id>: project_id and team_id are both null.
- **Expected:** The new document belongs to the project or team whose page it was created from, as with that page's own 'New document' button (which sets team_id / project_id). It then shows in that list. Round 3 fixed the same thing for issues: 'C / palette Create new issue did not prefill the page's project or cycle'.
- **Actual:** The document is created at workspace level (project_id = null, team_id = null). The project Documents tab still shows 'No documents in this project' and the team page still shows 'No documents'. A project can be set afterwards with 'Add to project', but the UI has no way to put an existing document into a team, so a team doc made from the palette can never appear on the team's Documents page. Seen 3 times (main journey plus 2 fresh-user runs) for both the project tab and the team page.
- **Suspected files:** frontend/src/components/WorkspaceCommands.tsx (`const newDocument = useNewDocument()` with no scope from the current route; the 'create-document' command calls newDocument.createAndOpen())

## Group `board-dnd`

### J1: Board: a card dropped into an empty column only lands there within about 30px of the column's centre; otherwise it stays put or lands in the next column (wrong status) (major)

- **Steps:** 1) Register a new user through the UI, onboard a workspace and create 2 issues in Todo (all other columns are empty). 2) Open /<ws>/team/ENG/issues?layout=board at 1440x900. 3) Grab card ENG-1 at its centre and drag it into the empty In Progress column. Release with the pointer 50px left of the column's centre (pointer x=1097, column spans x 973-1321, so about 90% of the dragged card is over In Progress). Reproduced twice in a fresh workspace (s24). The same thing happened in the journey workspace at 2400px wide. Dragging Todo to the empty In Review column and releasing 30, 60 or 90px right of its centre put the issue in Done. Releasing 30, 60 or 90px left of centre put it in In Progress. Dragging Done to the empty Canceled column and releasing 60px left of centre left it in Done. Only a drop within about 20px of the centre worked. At 1440px, after the board auto-scrolled, a drag of ENG-5 from Todo to In Review also ended up in Done (reproduced twice).
- **Expected:** The card moves to the column under the pointer and under the dragged card, here In Progress or In Review. The placeholder shows that column while hovering.
- **Actual:** During the drag the placeholder ghost stays in the origin column or in the next column, even though the pointer and nearly all of the dragged card are over the empty target column. On release the card snaps back to its old status (no PATCH is sent), or it is PATCHed to a different column. For example Todo->In Review released 30px right of centre gave state 'Done': completed_at was set and a status-change notification was sent. This is broader than the accepted note in the known-bugs list ('grabbed far from its centre and dropped left of an empty column's centre'). Here the card is grabbed at its centre, it fails in both directions, and the tolerance is only about ±30px on a 348px column. This is the everyday 'Todo to empty In Progress' move at the start of a sprint.
- **Suspected files:** frontend/src/components/board/KanbanBoard.tsx (closestCorners collision against tall empty-column droppables vs. card droppables; handleDragOver/handleDragEnd)

### J2: Board: reordering a card in the leftmost visible column of a scrolled board auto-scrolls the board and drops the card into another status (major)

- **Steps:** 1) Use the journey workspace (team ENG board, 1440x900) with ENG-6 and ENG-7 in Todo and ENG-8 in Backlog. 2) Scroll the board right by 400px (shift+wheel or trackpad) so Todo is the leftmost, partly visible column and In Review is in view. 3) Grab ENG-7 in the middle of its visible part and drag it straight up about 100px over about 1 second to place it above ENG-6. Let the pointer drift about 4px to the left, as a hand does. 4) Release over the top of ENG-6.
- **Expected:** ENG-7 is reordered above ENG-6 and stays in Todo. The board does not scroll sideways while the user drags vertically inside a visible column.
- **Actual:** While the user drags, the board scrolls all the way to the left (scrollLeft 400 -> 0 in under a second). Backlog slides under the pointer and the card is dropped there. ENG-7 is PATCHed to state Backlog and subscribers get a status-change notification. Reproduced 3 times: twice in a dedicated script and once during the journey. With zero horizontal drift no scroll happens, so a few pixels of normal hand movement trigger it.
- **Suspected files:** frontend/src/components/board/KanbanBoard.tsx (DndContext uses the default autoScroll: threshold is 20% of the board width, about 238px, so any leftward movement in that band scrolls the board)

## Group `misc`

### J3: Project page: the 'Issues N' tab count leaves out canceled issues that the list under it shows (minor)

- **Steps:** 1) Create a project with 3 issues in it: one Todo, one Done, one Canceled. 2) Open /<ws>/project/<id>?tab=issues. Reproduced in the journey (8 issues with 1 canceled: tab 'Issues 7', 8 rows listed) and in a fresh workspace (tab 'Issues 2', 3 rows listed).
- **Expected:** The tab count matches the issues listed on that tab.
- **Actual:** The tab badge shows project.issue_count, which excludes canceled (and archived) issues. The list under it shows every project issue, Canceled group included, so the count is one lower than the visible rows.
- **Suspected files:** frontend/src/routes/_authed/$workspaceKey/project/$projectId.tsx (around line 176: {project.issue_count} in the Issues tab)

### J7: L ('Change labels') does nothing on an issue in the list that has no labels (minor)

- **Steps:** 1. Open /<ws>/team/ENG/issues or My issues.
2. Press J until an issue without labels is highlighted (e.g. ENG-7 'Typo in onboarding copy' or DES-5 'Brand colors audit').
3. Press L.
4. For comparison, press S on the same row, or open the issue (Enter) and press L there.
- **Expected:** The label picker opens so the triager can add a first label from the keyboard. The '?' help lists 'Change labels: L' under 'Issue list'.
- **Actual:** Nothing happens: no picker opens and there is no feedback. L works only on rows that already have at least one label. On the same row S opens the status picker, and on the issue page L opens the label picker. Reproduced on ENG-7 (team list) and DES-5 (My issues).
- **Suspected files:** frontend/src/components/issues/IssuesView.tsx (onKeyDown: `kind !== 'labels' || issue.labels.length > 0`), frontend/src/components/issues/IssueRow.tsx (labels IssuePicker is only rendered when the issue has labels, so there is nothing to anchor it to)

### J8: Opening an issue from a 'commented' inbox notification does not show the new comment (major)

- **Steps:** 1. User B (Ben) is subscribed to ENG-1 and has it open (/<ws>/issue/ENG-1). B clicks 'Inbox' in the sidebar.
2. User A (Ada) posts a comment on ENG-1 (e.g. 'Ada reply 12345').
3. B waits on the Inbox. About 30 s later the poll shows the row 'Ada Engineer commented: "Ada reply 12345"'.
4. B selects the notification and clicks 'Open issue', about 38 s after first viewing the issue. Then B waits 4 s.
Reproduced twice: on ENG-1 (3 comments already) and on ENG-3 (no comments). Script: /tmp/claude-0/-home-user-linear-clone-template/0c354a77-8d14-54f5-8ce1-601d571a9e8b/scratchpad/journeys/issue-deep-work/s12-notif-open.mjs; screenshot shots/s12-notif-open-01-b-opened-from-inbox-ENG-1.png.
- **Expected:** The issue page opens with A's new comment in the timeline, because that is the comment the notification is about.
- **Actual:** The timeline shows only the comments that were there before (3 on ENG-1, 0 on ENG-3). A's comment is missing, even though GET /issues/{id}/comments returns it. The page shows cached comments, activity and issue data and does not refetch them on mount: the global staleTime is 60 s and refetchOnWindowFocus is false. The new comment only shows after a full browser reload. In a back-and-forth conversation, the teammate opens the notification and cannot see the reply.
- **Suspected files:** frontend/src/hooks/useIssueDetail.ts (useComments / useIssueActivity / useIssueByIdentifier use the global 60 s staleTime and no refetchOnMount), frontend/src/routes/__root.tsx (QueryClient defaults: staleTime 60 s, refetchOnWindowFocus false), frontend/src/routes/_authed/$workspaceKey/inbox.tsx / frontend/src/components/NotificationPreview.tsx ('Open issue' does not invalidate the issue's comment and activity queries).

### J9: Double-clicking Delete in the Delete document dialog sends two DELETEs: shows a false 'Could not delete document - Document <uuid> not found' error (or two 'Document deleted' toasts) (minor)

- **Steps:** 1. Open any document (e.g. /<ws>/document/<id>).
2. Click the '...' (Document actions) button, then 'Delete document'.
3. In the 'Delete document' alert dialog, double-click the red 'Delete' button (a normal double-click).
- **Expected:** The document is deleted once and only one 'Document deleted' toast is shown. This matches the Round 3 fix for the Delete cycle dialog, which ignores the second click.
- **Actual:** Two DELETE /documents/{id} requests are sent. The second usually gets a 404, so an error toast 'Could not delete document / Document 91876fd0-... not found' (with a raw UUID) appears next to 'Document deleted', even though the delete worked. When both requests reach the server together, the user gets two 'Document deleted' toasts instead. Seen in 3 of 3 attempts with fresh users: twice the false error plus 404 in the console, once the duplicate toast.
- **Suspected files:** frontend/src/components/documents/DeleteDocumentDialog.tsx (no `confirmed` ref guard, unlike DeleteCycleDialog.tsx); frontend/src/routes/_authed/$workspaceKey/document/$documentId.tsx confirmDelete()

