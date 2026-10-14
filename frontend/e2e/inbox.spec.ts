/**
 * Inbox (UX-3): notifications created by issue changes, the split view
 * (list + issue preview), read on open, J/K, unread filter, mark all read,
 * archive (with undo), delete, and the unread badge on the sidebar.
 */
import {
  addWorkspaceMember,
  createComment,
  createIssue,
  createWorkspace,
  deleteIssue,
  expect,
  getUnreadNotificationCount,
  listNotifications,
  listStates,
  listTeams,
  markAllNotificationsRead,
  registerUser,
  test,
  updateIssue,
  updateNotification,
  type Page,
  type TestUser,
} from './fixtures'

type Api = Parameters<typeof createWorkspace>[0]

/** Owner + member in one workspace; the owner acts, the member gets notified. */
async function setUp(api: Api, owner: TestUser) {
  const workspace = await createWorkspace(api, owner, { name: 'Inbox Co' })
  const member = await registerUser(api)
  const memberUser = await addWorkspaceMember(api, owner, workspace.id, member)
  const [team] = await listTeams(api, owner, workspace.id)
  const states = await listStates(api, owner, team.id)
  return { workspace, member, memberUser, team, states }
}

function rows(page: Page) {
  return page.getByRole('list', { name: 'Notifications' }).getByRole('listitem')
}

function inboxLink(page: Page) {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Inbox/ })
}

test.describe('inbox', () => {
  test('lists notifications, previews the issue, marks read on open and moves with J/K', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team, states } = await setUp(api, owner)
    const done = states.find(s => s.name === 'Done')
    if (!done) throw new Error('No Done state')

    const login = await createIssue(api, owner, {
      team_id: team.id,
      title: 'Fix the login page',
      description: '<p>The <strong>submit</strong> button does nothing.</p>',
      assignee_id: memberUser.id,
    })
    const billing = await createIssue(api, owner, { team_id: team.id, title: 'Billing export' })
    await updateIssue(api, owner, billing.id, { assignee_id: memberUser.id })
    await updateIssue(api, owner, billing.id, { state_id: done.id })
    // The actor is never notified: the owner's inbox stays empty.
    expect(await listNotifications(api, owner, workspace.id)).toEqual([])
    expect(await getUnreadNotificationCount(api, member, workspace.id)).toBe(3)

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inbox')
    await expect(inboxLink(page)).toContainText('3')

    // Newest first.
    await expect(rows(page)).toHaveCount(3)
    await expect(rows(page).nth(0)).toContainText('Billing export')
    await expect(rows(page).nth(0)).toContainText('changed status to Done')
    await expect(rows(page).nth(1)).toContainText(billing.identifier)
    await expect(rows(page).nth(1)).toContainText('assigned you')
    await expect(rows(page).nth(2)).toContainText('Fix the login page')
    await expect(rows(page).getByRole('img', { name: 'Unread' })).toHaveCount(3)
    await expect(page.getByText('No notification selected')).toBeVisible()

    // Open the oldest one: preview + read.
    await rows(page).nth(2).getByRole('button').first().click()
    const preview = page.getByRole('region', { name: 'Notification preview' })
    await expect(preview.getByRole('heading', { name: 'Fix the login page' })).toBeVisible()
    await expect(preview.getByText('does nothing')).toBeVisible()
    await expect(preview.locator('strong')).toHaveText('submit')
    await expect(preview.getByTestId('preview-status')).toHaveText('Todo')
    await expect(preview.getByRole('link', { name: 'Open issue' })).toHaveAttribute(
      'href',
      `/${workspace.url_key}/issue/${login.identifier}`
    )
    await expect(rows(page).nth(2).getByRole('img', { name: 'Unread' })).toHaveCount(0)
    await expect.poll(() => getUnreadNotificationCount(api, member, workspace.id)).toBe(2)
    await expect(inboxLink(page)).toContainText('2')

    // K moves up (and reads), J moves back down.
    await page.keyboard.press('k')
    await expect(rows(page).nth(1)).toHaveAttribute('data-selected', 'true')
    await expect(preview.getByRole('heading', { name: 'Billing export' })).toBeVisible()
    await expect(preview.getByTestId('preview-status')).toHaveText('Done')
    await expect.poll(() => getUnreadNotificationCount(api, member, workspace.id)).toBe(1)
    await page.keyboard.press('j')
    await expect(rows(page).nth(2)).toHaveAttribute('data-selected', 'true')

    // U marks the selected one unread again.
    await page.keyboard.press('u')
    await expect(rows(page).nth(2).getByRole('img', { name: 'Unread' })).toHaveCount(1)
    await expect.poll(() => getUnreadNotificationCount(api, member, workspace.id)).toBe(2)

    // Unread only: the two unread rows.
    await page.getByRole('button', { name: 'Show unread only' }).click()
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByText('Unread notifications')).toBeVisible()

    // Mark all as read empties the unread list.
    await page.getByRole('button', { name: 'Mark all as read' }).click()
    await expect(page.getByText('No unread notifications')).toBeVisible()
    await expect.poll(() => getUnreadNotificationCount(api, member, workspace.id)).toBe(0)
    await expect(inboxLink(page)).toHaveText('Inbox')

    await page.getByRole('button', { name: 'Show all notifications' }).click()
    await expect(rows(page)).toHaveCount(3)
    await expect(rows(page).getByRole('img', { name: 'Unread' })).toHaveCount(0)
  })

  test('a comment notification shows the comment in the row and the preview', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team } = await setUp(api, owner)
    // The member is subscribed as the assignee.
    const issue = await createIssue(api, owner, {
      team_id: team.id,
      title: 'Review the API',
      assignee_id: memberUser.id,
    })
    await createComment(api, owner, issue.id, '<p>Please check the <strong>auth</strong> part</p>')

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page).nth(0)).toContainText('commented: "Please check the auth part"')

    await rows(page).nth(0).getByRole('button').first().click()
    const comment = page
      .getByRole('region', { name: 'Notification preview' })
      .getByRole('blockquote', { name: 'Comment' })
    await expect(comment).toContainText('Please check the auth part')
    await expect(comment.locator('strong')).toHaveText('auth')
  })

  test('Open issue on a comment notification shows the new comment on the issue page', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team } = await setUp(api, owner)
    const issue = await createIssue(api, owner, {
      team_id: team.id,
      title: 'Talk it over',
      assignee_id: memberUser.id,
    })
    await createComment(api, owner, issue.id, '<p>First thought</p>')

    // The member reads the issue first: its comments and activity are cached.
    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/issue/${issue.identifier}`)
    const main = page.getByRole('main')
    await expect(main.getByText('First thought')).toBeVisible()

    await createComment(api, owner, issue.id, '<p>A reply to read</p>')
    await inboxLink(page).click()
    await expect(rows(page).nth(0)).toContainText('commented: "A reply to read"')
    await rows(page).nth(0).getByRole('button').first().click()
    await page
      .getByRole('region', { name: 'Notification preview' })
      .getByRole('link', { name: 'Open issue' })
      .click()

    await expect(page).toHaveURL(`/${workspace.url_key}/issue/${issue.identifier}`)
    await expect(main.getByText('A reply to read')).toBeVisible()
    await expect(main.getByText('First thought')).toBeVisible()
  })

  test('archives with undo, deletes, and opens the issue page', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team } = await setUp(api, owner)
    const first = await createIssue(api, owner, {
      team_id: team.id,
      title: 'First task',
      assignee_id: memberUser.id,
    })
    await createIssue(api, owner, {
      team_id: team.id,
      title: 'Second task',
      assignee_id: memberUser.id,
    })

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(rows(page)).toHaveCount(2)

    // Archive from the row's hover action, then undo from the toast.
    await rows(page).nth(1).hover()
    await rows(page).nth(1).getByRole('button', { name: 'Archive' }).click()
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Second task')
    // The UI updates at once; the server write follows.
    await expect
      .poll(async () => {
        const all = await listNotifications(api, member, workspace.id, '&include_archived=true')
        return all.find(n => n.issue_id === first.id)?.archived_at ?? null
      })
      .not.toBeNull()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(rows(page)).toHaveCount(2)

    // E archives the selected one and selects the next.
    await page.keyboard.press('j')
    await expect(rows(page).nth(0)).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('e')
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('First task')
    await expect(rows(page).first()).toHaveAttribute('data-selected', 'true')

    // Delete from the preview.
    const preview = page.getByRole('region', { name: 'Notification preview' })
    await preview.getByRole('button', { name: 'Delete notification' }).click()
    await expect(page.getByText('No notifications', { exact: true })).toBeVisible()
    await expect
      .poll(async () =>
        (await listNotifications(api, member, workspace.id, '&include_archived=true')).map(
          n => n.issue?.title
        )
      )
      .toEqual(['Second task'])
    const left = await listNotifications(api, member, workspace.id, '&include_archived=true')

    // Restore the archived one through the API, then open its issue with Enter.
    const restored = await updateNotification(api, member, left[0].id, { archived: false })
    expect(restored.archived_at).toBeNull()
    await page.reload()
    await expect(rows(page)).toHaveCount(1)
    await page.keyboard.press('j')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/issue/ENG-2$`))
  })

  test('the sidebar badge shows the unread count on every workspace page', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team } = await setUp(api, owner)
    await createIssue(api, owner, { team_id: team.id, title: 'One', assignee_id: memberUser.id })

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(inboxLink(page)).toContainText('1')

    expect(await markAllNotificationsRead(api, member, workspace.id)).toBe(1)
    await page.reload()
    await expect(rows(page)).toHaveCount(1)
    await expect(inboxLink(page)).toHaveText('Inbox')
  })

  test('each status notification keeps the status it moved to', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team, states } = await setUp(api, owner)
    const inProgress = states.find(s => s.name === 'In Progress')
    const done = states.find(s => s.name === 'Done')
    if (!inProgress || !done) throw new Error('Missing default states')
    const issue = await createIssue(api, owner, {
      team_id: team.id,
      title: 'Ship the release',
      assignee_id: memberUser.id,
    })
    await updateIssue(api, owner, issue.id, { state_id: inProgress.id })
    await updateIssue(api, owner, issue.id, { state_id: done.id })

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(rows(page)).toHaveCount(3)
    await expect(rows(page).nth(0)).toContainText('changed status to Done')
    // Not the issue's current status (Done): the one picked then.
    await expect(rows(page).nth(1)).toContainText('changed status to In Progress')
  })

  test('the preview shows the issue as it is now, not as it was first opened', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team, states } = await setUp(api, owner)
    const done = states.find(s => s.name === 'Done')
    if (!done) throw new Error('No Done state')
    const issue = await createIssue(api, owner, {
      team_id: team.id,
      title: 'Original title',
      assignee_id: memberUser.id,
    })
    await updateIssue(api, owner, issue.id, { state_id: done.id })

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(rows(page)).toHaveCount(2)
    const preview = page.getByRole('region', { name: 'Notification preview' })
    await rows(page).nth(1).getByRole('button').first().click()
    await expect(preview.getByRole('heading', { name: 'Original title' })).toBeVisible()
    await expect(preview.getByText('No priority')).toBeVisible()

    // A teammate changes the issue while the inbox stays open.
    await updateIssue(api, owner, issue.id, { title: 'Renamed title', priority: 1 })
    await rows(page).nth(0).getByRole('button').first().click()
    await expect(preview.getByRole('heading', { name: 'Renamed title' })).toBeVisible()
    await expect(preview.getByText('Urgent')).toBeVisible()
    await expect(preview.getByTestId('preview-status')).toHaveText('Done')
  })

  test('on a phone the preview replaces the list, with a way back', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team } = await setUp(api, owner)
    await createIssue(api, owner, {
      team_id: team.id,
      title: 'Mobile task',
      assignee_id: memberUser.id,
    })

    const page = await loginAs(member)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${workspace.url_key}/inbox`)
    const list = page.getByRole('list', { name: 'Notifications' })
    const preview = page.getByRole('region', { name: 'Notification preview' })
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Back to inbox' })).toHaveCount(0)
    // The sidebar (and its Inbox badge) is behind the menu: the menu button shows the unread dot.
    await expect(
      page.getByRole('button', { name: 'Open menu (1 unread notifications)' })
    ).toBeVisible()
    await expect(page.getByTestId('menu-unread-dot')).toBeVisible()

    await rows(page).first().getByRole('button').first().click()
    await expect(preview.getByRole('heading', { name: 'Mobile task' })).toBeVisible()
    await expect(preview.getByRole('link', { name: 'Open issue' })).toBeVisible()
    await expect(list).toBeHidden()

    await preview.getByRole('button', { name: 'Back to inbox' }).click()
    await expect(list).toBeVisible()
    await expect(preview).toHaveCount(0)
    // Opening it read it: no dot left.
    await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeVisible()
    await expect(page.getByTestId('menu-unread-dot')).toHaveCount(0)
  })

  test('a teammate deleting the issue closes its preview instead of failing on it', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, member, memberUser, team } = await setUp(api, owner)
    await createIssue(api, owner, {
      team_id: team.id,
      title: 'Kept task',
      assignee_id: memberUser.id,
    })
    const doomed = await createIssue(api, owner, {
      team_id: team.id,
      title: 'Doomed task',
      assignee_id: memberUser.id,
    })

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(rows(page)).toHaveCount(2)
    const preview = page.getByRole('region', { name: 'Notification preview' })
    await rows(page).filter({ hasText: 'Doomed task' }).getByRole('button').first().click()
    await expect(preview.getByRole('heading', { name: 'Doomed task' })).toBeVisible()

    // Deleting the issue deletes its notifications too.
    await deleteIssue(api, owner, doomed.id)
    await page.keyboard.press('u')
    await expect(page.getByText('This notification was deleted')).toBeVisible()
    await expect(page.getByText(/not found/)).toHaveCount(0)
    await expect(preview).toHaveCount(0)
    await expect(page.getByText('No notification selected')).toBeVisible()
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('Kept task')
  })

  test('Enter opens the selected notification only from its own row, not from other buttons', async ({
    api,
    user: owner,
    loginAs,
  }) => {
    const { workspace, memberUser, member, team } = await setUp(api, owner)
    await createIssue(api, owner, {
      team_id: team.id,
      title: 'Older task',
      assignee_id: memberUser.id,
    })
    const newer = await createIssue(api, owner, {
      team_id: team.id,
      title: 'Newer task',
      assignee_id: memberUser.id,
    })

    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/inbox`)
    await expect(rows(page)).toHaveCount(2)
    await rows(page).nth(0).getByRole('button').first().click()
    const preview = page.getByRole('region', { name: 'Notification preview' })
    await expect(preview.getByRole('heading', { name: 'Newer task' })).toBeVisible()

    // Enter on a focused preview button clicks that button.
    await preview.getByRole('button', { name: 'Mark as unread' }).focus()
    await page.keyboard.press('Enter')
    await expect(rows(page).nth(0).getByRole('img', { name: 'Unread' })).toHaveCount(1)
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/inbox$`))

    // Enter on another focused row selects that row instead of opening the selected one.
    await rows(page).nth(1).getByRole('button').first().focus()
    await page.keyboard.press('Enter')
    await expect(rows(page).nth(1)).toHaveAttribute('data-selected', 'true')
    await expect(preview.getByRole('heading', { name: 'Older task' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/inbox$`))

    // Focus follows K, so Enter then opens the newly selected notification.
    await page.keyboard.press('k')
    await expect(rows(page).nth(0)).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/issue/${newer.identifier}$`))
  })
})
