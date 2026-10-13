/**
 * Issue list / board (ISS-1, ISS-3, ISS-4, ISS-5, ISS-12, ISS-13, ISS-14):
 * the create-issue modal, the team and "My issues" pages, inline property
 * pickers, filters and display options in the URL, board drag and drop,
 * multi-select bulk actions, keyboard navigation and the context menu.
 */
import {
  bulkDeleteIssues,
  bulkUpdateIssues,
  createIssue,
  createWorkspace,
  expect,
  getIssue,
  getMe,
  listIssues,
  listLabels,
  listStates,
  listTeams,
  test,
  type Page,
  type TestUser,
} from './fixtures'

async function seedWorkspace(api: Parameters<typeof createWorkspace>[0], user: TestUser) {
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const states = Object.fromEntries(
    (await listStates(api, user, team.id)).map(state => [state.name, state])
  )
  const labels = Object.fromEntries(
    (await listLabels(api, user, workspace.id)).map(label => [label.name, label])
  )
  return { workspace, team, states, labels, key: workspace.url_key }
}

function issueList(page: Page) {
  return page.getByRole('listbox', { name: 'Issues' })
}

function row(page: Page, title: string) {
  return issueList(page).getByRole('option', { name: new RegExp(title) })
}

test.describe('issues list', () => {
  test('creates an issue with properties from the modal (ISS-1)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { workspace, key } = await seedWorkspace(api, user)
    const page = await loginAs(user)
    await page.goto(`/${key}`)
    await expect(page.getByRole('button', { name: 'Compose issue' })).toBeVisible()

    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByRole('heading', { level: 1, name: 'Issues' })).toBeVisible()
    await expect(page.getByText('No issues yet')).toBeVisible()

    // The sidebar "Compose issue" button opens the modal.
    await page.getByRole('button', { name: 'Compose issue' }).click()
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Team: Engineering' })).toBeVisible()
    await dialog.getByLabel('Issue title').fill('Login page crashes')
    await dialog.getByRole('textbox', { name: 'Issue description' }).click()
    await page.keyboard.type('Stack trace attached')

    await dialog.getByRole('button', { name: 'Priority: No priority' }).click()
    await page.getByRole('option', { name: 'High' }).click()
    await dialog.getByRole('button', { name: /^Labels:/ }).click()
    await page.getByRole('option', { name: 'Bug' }).click()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: /^Status:/ }).click()
    await page.getByRole('option', { name: 'In Progress' }).click()
    await dialog.getByRole('button', { name: /^Due date:/ }).click()
    await page.getByRole('button', { name: /^Tomorrow/ }).click()
    await dialog.getByRole('button', { name: /^Estimate:/ }).click()
    await page.getByRole('option', { name: '3 points', exact: true }).click()

    await dialog.getByLabel('Issue title').press('ControlOrMeta+Enter')
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Created ENG-1')).toBeVisible()
    await expect(row(page, 'Login page crashes')).toBeVisible()
    await expect(page.getByRole('group', { name: 'In Progress' })).toContainText(
      'Login page crashes'
    )

    const [issue] = (await listIssues(api, user, workspace.id)).items
    expect(issue).toMatchObject({
      identifier: 'ENG-1',
      title: 'Login page crashes',
      priority: 2,
      estimate: 3,
      state: { name: 'In Progress' },
    })
    expect(issue.labels.map(l => l.name)).toEqual(['Bug'])
    expect(issue.description).toContain('Stack trace attached')
    expect(issue.due_date).not.toBeNull()

    // "Create more" keeps the modal open; the C key opens it.
    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('switch', { name: 'Create more' }).click()
    await dialog.getByLabel('Issue title').fill('Second issue')
    await dialog.getByRole('button', { name: 'Create issue' }).click()
    await expect(page.getByText('Created ENG-2')).toBeVisible()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Issue title')).toHaveValue('')
    await dialog.getByLabel('Issue title').fill('Third issue')
    await dialog.getByLabel('Issue title').press('ControlOrMeta+Enter')
    await expect(page.getByText('Created ENG-3')).toBeVisible()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(row(page, 'Third issue')).toBeVisible()
    await expect.poll(async () => (await listIssues(api, user, workspace.id)).total).toBe(3)

    // A missing title shows the form error.
    await page.getByRole('button', { name: 'New issue' }).first().click()
    await dialog.getByRole('button', { name: 'Create issue' }).click()
    await expect(dialog.getByText('Title is required')).toBeVisible()
  })

  test('the description slash menu and Cmd+Enter keep the modal draft intact (ISS-1)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { workspace, key } = await seedWorkspace(api, user)
    const page = await loginAs(user)
    await page.goto(`/${key}`)
    await expect(page.getByRole('button', { name: 'Compose issue' })).toBeVisible()
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByText('No issues yet')).toBeVisible()

    await page.getByRole('button', { name: 'Compose issue' }).click()
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Issue title').fill('Important title')
    const description = dialog.getByRole('textbox', { name: 'Issue description' })
    await description.click()
    await page.keyboard.type('Long description I wrote. /')
    const slashMenu = page.getByRole('listbox', { name: 'Insert block' })
    await expect(slashMenu).toBeVisible()

    // Escape closes only the slash menu: the modal and its draft stay.
    await page.keyboard.press('Escape')
    await expect(slashMenu).toBeHidden()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Issue title')).toHaveValue('Important title')
    await expect(description).toContainText('Long description I wrote. /')

    // A second Escape (no menu open) still closes the modal.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    // Cmd+Enter from the description submits without adding a hard break.
    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Issue title').fill('Cmd enter from description')
    await description.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Delete')
    await page.keyboard.type('desc text')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(dialog).toBeHidden()
    await expect(row(page, 'Cmd enter from description')).toBeVisible()

    const issues = (await listIssues(api, user, workspace.id)).items
    const created = issues.find(issue => issue.title === 'Cmd enter from description')
    expect(created?.description).toBe('<p>desc text</p>')
  })

  test('groups by status, changes properties inline and switches tabs (ISS-3, ISS-13)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, states, key } = await seedWorkspace(api, user)
    const todo = await createIssue(api, user, { team_id: team.id, title: 'Todo work' })
    await createIssue(api, user, {
      team_id: team.id,
      title: 'Backlog idea',
      state_id: states.Backlog.id,
    })
    await createIssue(api, user, {
      team_id: team.id,
      title: 'Started work',
      state_id: states['In Progress'].id,
    })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByRole('group', { name: 'Backlog' })).toContainText('Backlog idea')
    await expect(page.getByRole('group', { name: 'Todo' })).toContainText('Todo work')
    await expect(page.getByRole('group', { name: 'In Progress' })).toContainText('Started work')

    // Inline status picker.
    await row(page, 'Todo work').getByRole('button', { name: 'Status: Todo' }).click()
    await page.getByRole('option', { name: 'In Review' }).click()
    await expect(page.getByRole('group', { name: 'In Review' })).toContainText('Todo work')
    await expect.poll(async () => (await getIssue(api, user, todo.id)).state.name).toBe('In Review')

    // Inline priority and assignee pickers.
    await row(page, 'Todo work').getByRole('button', { name: 'Priority: No priority' }).click()
    await page.getByRole('option', { name: 'Urgent' }).click()
    await row(page, 'Todo work').getByRole('button', { name: 'Assignee: Unassigned' }).click()
    await page.getByRole('option', { name: /\(you\)/ }).click()
    await expect.poll(async () => (await getIssue(api, user, todo.id)).priority).toBe(1)
    await expect
      .poll(async () => (await getIssue(api, user, todo.id)).assignee?.email)
      .toBe(user.email)

    // Tabs: Active = unstarted + started, Backlog = backlog only.
    await page.getByRole('tab', { name: 'Active' }).click()
    await expect(page).toHaveURL(/tab=active/)
    await expect(row(page, 'Started work')).toBeVisible()
    await expect(row(page, 'Backlog idea')).toBeHidden()
    await page.getByRole('tab', { name: 'Backlog' }).click()
    await expect(row(page, 'Backlog idea')).toBeVisible()
    await expect(row(page, 'Started work')).toBeHidden()
    await page.getByRole('tab', { name: 'All issues' }).click()
    await expect(row(page, 'Started work')).toBeVisible()
  })

  test('filters, search and display options live in the URL (ISS-5)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, states, labels, key } = await seedWorkspace(api, user)
    await createIssue(api, user, {
      team_id: team.id,
      title: 'Crash on save',
      priority: 1,
      label_ids: [labels.Bug.id],
    })
    await createIssue(api, user, { team_id: team.id, title: 'Polish header', priority: 3 })
    await createIssue(api, user, {
      team_id: team.id,
      title: 'Finished thing',
      state_id: states.Done.id,
    })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(row(page, 'Polish header')).toBeVisible()

    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('menuitem', { name: 'Priority' }).click()
    await page.getByRole('option', { name: 'Urgent' }).click()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/priority=urgent/)
    await expect(row(page, 'Crash on save')).toBeVisible()
    await expect(row(page, 'Polish header')).toBeHidden()
    await expect(page.getByRole('group', { name: 'Priority filter' })).toContainText('Urgent')

    // The view survives a reload.
    await page.reload()
    await expect(row(page, 'Crash on save')).toBeVisible()
    await expect(row(page, 'Polish header')).toBeHidden()
    await page.getByRole('button', { name: 'Remove priority filter' }).click()
    await expect(row(page, 'Polish header')).toBeVisible()

    // Label filter and search.
    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('menuitem', { name: 'Labels' }).click()
    await page.getByRole('option', { name: 'Bug' }).click()
    await page.keyboard.press('Escape')
    await expect(row(page, 'Polish header')).toBeHidden()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.getByLabel('Search issues').fill('polish')
    await expect(page).toHaveURL(/q=polish/)
    await expect(row(page, 'Polish header')).toBeVisible()
    await expect(row(page, 'Crash on save')).toBeHidden()
    await page.getByLabel('Search issues').fill('')
    await expect(row(page, 'Crash on save')).toBeVisible()

    // Display options: hide completed, group by priority, board layout.
    await page.getByRole('button', { name: 'Display' }).click()
    await page.getByRole('switch', { name: 'Show completed issues' }).click()
    await expect(page).toHaveURL(/completed=hide/)
    await expect(row(page, 'Finished thing')).toBeHidden()
    await page.getByRole('combobox', { name: 'Grouping' }).click()
    await page.getByRole('option', { name: 'Priority' }).click()
    await expect(page).toHaveURL(/group=priority/)
    await expect(page.getByRole('group', { name: 'Urgent' })).toContainText('Crash on save')
    await page.getByRole('combobox', { name: 'Ordering' }).click()
    await page.getByRole('option', { name: 'Created' }).click()
    await expect(page).toHaveURL(/order=created/)
    await page.getByRole('button', { name: 'Board' }).click()
    await expect(page).toHaveURL(/layout=board/)
    await page.keyboard.press('Escape')
    const board = page.getByRole('region', { name: 'Issue board' })
    await expect(board.getByRole('region', { name: 'Medium' })).toContainText('Polish header')
  })

  test('drags a card to another status column on the board (ISS-4)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, key } = await seedWorkspace(api, user)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Drag me' })
    await createIssue(api, user, { team_id: team.id, title: 'Already started' })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues?layout=board`)
    const board = page.getByRole('region', { name: 'Issue board' })
    const card = board.locator('[data-issue-card="ENG-1"]')
    const target = board.getByRole('region', { name: 'In Progress' })
    await expect(card).toBeVisible()

    const from = await card.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) throw new Error('board not laid out')
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 })
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 })
    await page.mouse.up()

    await expect(target).toContainText('Drag me')
    await expect
      .poll(async () => (await getIssue(api, user, issue.id)).state.name)
      .toBe('In Progress')
  })

  test('selects rows and runs bulk actions (ISS-14)', async ({ api, user, loginAs }) => {
    const { workspace, team, key } = await seedWorkspace(api, user)
    const one = await createIssue(api, user, { team_id: team.id, title: 'Bulk one' })
    const two = await createIssue(api, user, { team_id: team.id, title: 'Bulk two' })
    await createIssue(api, user, { team_id: team.id, title: 'Bulk three' })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await row(page, 'Bulk one').getByRole('checkbox', { name: 'Select row' }).click()
    await row(page, 'Bulk two').getByRole('checkbox', { name: 'Select row' }).click()
    const bar = page.getByRole('toolbar', { name: 'Bulk actions' })
    await expect(bar).toContainText('2 issues selected')

    await bar.getByRole('button', { name: 'Priority' }).click()
    await page.getByRole('option', { name: 'High' }).click()
    await expect.poll(async () => (await getIssue(api, user, one.id)).priority).toBe(2)
    expect((await getIssue(api, user, two.id)).priority).toBe(2)

    await bar.getByRole('button', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Done' }).click()
    await expect.poll(async () => (await getIssue(api, user, two.id)).state.name).toBe('Done')

    await bar.getByRole('button', { name: 'Label' }).click()
    await page.getByRole('option', { name: 'Feature' }).click()
    await expect
      .poll(async () => (await getIssue(api, user, one.id)).labels.map(l => l.name))
      .toEqual(['Feature'])

    await bar.getByRole('button', { name: 'Delete' }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('Delete 2 issues?')
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(row(page, 'Bulk one')).toBeHidden()
    await expect(bar).toBeHidden()
    await expect.poll(async () => (await listIssues(api, user, workspace.id)).total).toBe(1)

    // The API helpers cover the same endpoints directly.
    const [left] = (await listIssues(api, user, workspace.id)).items
    const [updated] = await bulkUpdateIssues(api, user, {
      issue_ids: [left.id],
      update: { priority: 4 },
    })
    expect(updated.priority).toBe(4)
    await bulkDeleteIssues(api, user, [left.id])
    expect((await listIssues(api, user, workspace.id)).total).toBe(0)
  })

  test('keyboard navigation, pickers and the context menu (ISS-2, ISS-12)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { workspace, team, key } = await seedWorkspace(api, user)
    const first = await createIssue(api, user, { team_id: team.id, title: 'Keyboard first' })
    await createIssue(api, user, { team_id: team.id, title: 'Keyboard second' })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(row(page, 'Keyboard first')).toBeVisible()
    await issueList(page).focus()

    await page.keyboard.press('j')
    await expect(issueList(page)).toHaveAttribute('aria-activedescendant', new RegExp(first.id))
    await page.keyboard.press('p')
    await expect(page.getByRole('combobox', { name: 'Priority' })).toBeVisible()
    await page.keyboard.press('2')
    await expect.poll(async () => (await getIssue(api, user, first.id)).priority).toBe(2)

    await issueList(page).focus()
    await page.keyboard.press('s')
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible()
    await page.keyboard.press('Escape')

    // Right-click: context menu > Delete.
    await row(page, 'Keyboard second').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete issue…' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(row(page, 'Keyboard second')).toBeHidden()
    await expect.poll(async () => (await listIssues(api, user, workspace.id)).total).toBe(1)

    // Enter opens the focused issue by its identifier.
    await issueList(page).focus()
    await page.keyboard.press('j')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/${key}/issue/ENG-1`)
  })

  test('my issues shows assigned, created and subscribed issues (ISS-13)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, key } = await seedWorkspace(api, user)
    const page = await loginAs(user)
    await page.goto(`/${key}/my-issues`)
    await expect(page.getByRole('heading', { level: 1, name: 'My issues' })).toBeVisible()
    await expect(page.getByText('Issues assigned to you show up here.')).toBeVisible()

    const me = await getMe(api, user)
    await createIssue(api, user, { team_id: team.id, title: 'Mine to do', assignee_id: me.id })
    await createIssue(api, user, { team_id: team.id, title: 'Written by me' })

    await page.reload()
    await expect(row(page, 'Mine to do')).toBeVisible()
    await expect(row(page, 'Written by me')).toBeHidden()

    await page.getByRole('tab', { name: 'Created' }).click()
    await expect(page).toHaveURL(`/${key}/my-issues?tab=created`)
    await expect(row(page, 'Written by me')).toBeVisible()
    await expect(row(page, 'Mine to do')).toBeVisible()

    await page.getByRole('tab', { name: 'Subscribed' }).click()
    await expect(row(page, 'Written by me')).toBeVisible()

    // A row opens the issue page by identifier.
    await row(page, 'Written by me').getByText('Written by me').click()
    await expect(page).toHaveURL(`/${key}/issue/ENG-2`)
  })
})
