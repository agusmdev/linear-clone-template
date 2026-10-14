# Final acceptance pass

- **Date:** 2026-10-14
- **Commit tested:** `acfeac8` (main, after the round 11 fixes)
- **Stack:** `docker compose up -d --build` with the CA/proxy build override from `docs/handoff/qa-session.md` (the override is not committed). Frontend http://localhost:3000, backend http://localhost:9095, Postgres 18.1.
- **Method:** Playwright scripts drove headless Chromium against the running app. Two users were registered fresh: user A through the UI, user B through the API and then invited by A. Every check went through the UI and was confirmed after a reload or through the API. Screenshots were taken at each step. The scripts also logged console errors and failed requests: the only ones were the expected 401 on a wrong password and the 404 on `ENG-999`.
- **Result:** 42 / 42 PASS, 0 FAIL. No code changes were needed.

| ID | Result | What was done |
|---|---|---|
| AUTH-1 | PASS | Registered with name, email and password on `/register`. No email verification; the user was signed in at once and sent to `/onboarding`. |
| AUTH-2 | PASS | Logged out from the workspace menu. A wrong password showed "Invalid email or password". Logging in again opened `/<ws>/my-issues`. |
| AUTH-3 | PASS | Logged out, opened `/onboarding`, `/<ws>/my-issues` and `/<ws>/team/ENG/issues`: each redirected to `/login?redirect=…`. After sign-in the user landed back on the requested page. |
| WS-1 | PASS | Onboarding took a workspace name and URL key, created the workspace with the Engineering (ENG) team and the 6 default states, and landed on My issues. |
| WS-2 | PASS | Created a second workspace "Second Co" via "Create or join workspace", then switched back to Acme QA with the sidebar switcher. |
| WS-3 | PASS | Invited an existing user by email and changed their role Member → Admin (kept after reload) → Member. Invited a third user, then removed them with the confirm dialog. |
| WS-4 | PASS | Created a team (key DES suggested automatically). Renamed it and changed its key to DSQ. Added and removed a member, left and joined. The key `ab1` was refused ("Use 2 to 5 uppercase letters"). Deleted the team. |
| WS-5 | PASS | Defaults: Backlog/Todo/In Progress/In Review/Done/Canceled. Added QA, renamed it Testing, recolored it to #4cb782 and moved it up; the order In Progress, Testing, In Review was kept after reload. Deleted it. |
| WS-6 | PASS | Default labels Bug, Feature and Improvement. Created Design, renamed it UX, recolored it, then created and deleted Temp; all kept after reload. |
| WS-7 | PASS | Changed the display name on the Profile page; it was kept after reload, then restored. |
| ISS-1 | PASS | Opened the modal with `C` and set title, a bold description, status, priority, assignee, label, project, cycle, estimate and due date. Cmd+Enter created ENG-1 with every property. An empty title keeps the modal open. "Create more" made 4 more issues. |
| ISS-2 | PASS | Issues were numbered ENG-1…ENG-10 in order. `/<ws>/issue/ENG-5` opened the issue; `ENG-999` showed "Issue not found". |
| ISS-3 | PASS | The list is grouped by Backlog/Todo/In Progress and each row shows priority, ID, status, title, label, project, due date, date and avatar. Changing priority inline on ENG-4 was kept after reload. |
| ISS-4 | PASS | On the board, dragged ENG-2 from Todo to In Review (API state In Review). Reordered Todo from ENG-4,ENG-5 to ENG-5,ENG-4. Both were kept after reload. |
| ISS-5 | PASS | Filters by status, priority, assignee, labels, project, cycle and creator each returned the expected rows, with the filter in the URL. A filter was kept after reload. Search for "dark" found ENG-2. Ordering offers Manual/Priority/Created/Updated/Due date and grouping offers Status/Assignee/Priority/Project/None; `order=priority&group=assignee` was kept after reload. |
| ISS-6 | PASS | On ENG-2: edited the title, typed a description (autosaved), and set status, priority, assignee, label, project, cycle, estimate and due date from the sidebar. All were kept after reload. |
| ISS-7 | PASS | Added 2 sub-issues to ENG-1 inline. Progress went from 0/2 to 1/2 after one was completed. The sub-issue page shows the ENG-1 parent breadcrumb. |
| ISS-8 | PASS | Added blocking ENG-4, blocked by ENG-3, related to ENG-5 and duplicate of ENG-2. ENG-4 shows the inverse "Blocked by ENG-1". Removed the ENG-5 relation. Kept after reload. |
| ISS-9 | PASS | Added a comment with markdown bold (rendered as `<strong>`), edited it (shows "(edited)", kept after reload), then added and deleted a second comment. |
| ISS-10 | PASS | The ENG-2 timeline reads: created, status, title, description, priority, assignee, label, project, cycle, estimate, due date and relation changes, merged with comments. |
| ISS-11 | PASS | The creator was subscribed automatically. Assigning ENG-4 to user B subscribed B. Unsubscribe was kept after reload; subscribed again. |
| ISS-12 | PASS | Archived ENG-10 (banner shown, `archived_at` set) and restored it. Deleted it via "Delete issue ENG-10?"; the page went to team issues and the API returns 404. |
| ISS-13 | PASS | Team tabs: All shows 5, Active shows 4, Backlog shows ENG-3. My issues tabs Assigned, Created and Subscribed each show the right set. |
| ISS-14 | PASS | Selected rows with checkboxes plus a shift-click range (4 selected). Bulk priority High, status In Progress and assignee were checked in the API. Bulk-deleted 2 temporary issues. |
| DOC-1 | PASS | The sidebar Documents list shows icon, title, project, author and updated time. Search "release" found 1 document; "zzzz" showed "No documents found". `/team/ENG/documents` creates and lists team documents. |
| DOC-2 | PASS | "New document" created a document; set its title "Release plan" and the 🚀 icon. A team document was created from the team page. |
| DOC-3 | PASS | Markdown shortcuts made H1, bold, italic, strike, inline code, bullet and numbered lists, checklist, quote, code block and horizontal rule. The slash menu inserted a heading. The bubble toolbar "Add link" made a link that was kept after reload. |
| DOC-4 | PASS | "Unsaved" turned into "Saved". After reload the title, icon and every block were still there. The header shows "Last edited by QA Tester · just now". |
| DOC-5 | PASS | Renamed to "Release plan v2" and moved to project Mobile launch with the Project chip (the breadcrumb follows). Deleted "Doomed doc" via the actions menu and the confirm dialog; it is gone from the list. |
| DOC-6 | PASS | The Documents tab of project Mobile launch lists "Release plan v2". |
| DOC-7 | PASS | Typing "ENG-1" in the document made a link to `/<ws>/issue/ENG-1`; clicking it opened the issue. |
| PRJ-1 | PASS | Created "Mobile launch" with description, icon, color, status, lead, start and target dates and a team. Changed the status to Paused (kept after reload) and back. Created and deleted "Obsolete". |
| PRJ-2 | PASS | The projects list shows Mobile launch at 50% (2 of 4 issues completed), matching the API. The team projects page lists it too. |
| PRJ-3 | PASS | Overview shows "50%, 2 of 4 issues completed". The Issues tab works as a list (4 issues) and as a board. The Documents tab lists the moved document. |
| CYC-1 | PASS | Created current "Sprint A" and upcoming "Sprint B"; overlapping dates were refused with a toast. Assigned ENG-1 and ENG-2; completing ENG-2 put the row at 50%. The cycle page lists its issues. |
| UX-1 | PASS | Cmd+K showed 18 default actions. Search found ENG-2 and "Release plan v2" (opened it). "create new issue" opened the modal; "engineering issues" navigated to the team issues. |
| UX-2 | PASS | `C` opened New issue, `G I` opened the inbox, `G M` opened My issues, `?` showed the shortcuts dialog, `/` opened search. In the list, J/K moved the focus, S/P/A opened the pickers and Enter opened the issue. |
| UX-3 | PASS | User B, the assignee of ENG-4, got 3 notifications: assigned, comment and status change, with an "Inbox 3" badge. Opening one showed the preview and marked it read; "Mark all as read" cleared the badge. |
| UX-4 | PASS | `/search` with All/Issues/Documents/Projects tabs: "launch" found the project, "release" the document, "crash" 2 issues + 1 document, "dark" ENG-2. |
| UX-5 | PASS | Starred issue ENG-1, document "Release plan v2" and project "Mobile launch": all 3 appear under Favorites in the sidebar and clicking one opens it. Unstarring removes it. |
| UX-6 | PASS | Dark is the default. Switching to Light on the profile page was kept after reload and the pages are readable; switched back to Dark. |

## Fixes

None. No feature failed, so no code or tests changed.

## Notes (not defects)

- A user created through `POST /auth/register` without a name shows their email as the display name (member lists, inbox avatar). The UI register form always sends a name.
- An invited member does not join any team on their own, so their "Your teams" list is empty until they join one (WS-4 covers join).
