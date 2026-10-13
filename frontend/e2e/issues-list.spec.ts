/**
 * Issue list / board (ISS-1, ISS-3, ISS-4, ISS-5, ISS-12, ISS-13, ISS-14):
 * the create-issue modal, the team and "My issues" pages, inline property
 * pickers, filters and display options in the URL, board drag and drop,
 * multi-select bulk actions, keyboard navigation and the context menu.
 */
import {
  authHeaders,
  bulkDeleteIssues,
  bulkUpdateIssues,
  createIssue,
  createProject,
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
import type { Issue } from '../src/types/issue'

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
    // After a click on the button, focus goes back to the title: the next
    // title can be typed at once, without a click.
    await expect(dialog.getByLabel('Issue title')).toBeFocused()
    await page.keyboard.type('Third issue')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.getByText('Created ENG-3')).toBeVisible()
    await expect(dialog.getByLabel('Issue title')).toHaveValue('')
    await expect(dialog.getByLabel('Issue title')).toBeFocused()
    // Cmd+Enter from the title also keeps focus on the title.
    await page.keyboard.type('Fourth issue')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.getByText('Created ENG-4')).toBeVisible()
    await expect(dialog.getByLabel('Issue title')).toBeFocused()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(row(page, 'Third issue')).toBeVisible()
    await expect(row(page, 'Fourth issue')).toBeVisible()
    await expect.poll(async () => (await listIssues(api, user, workspace.id)).total).toBe(4)

    // A missing title shows the form error.
    await page.getByRole('button', { name: 'New issue' }).first().click()
    await dialog.getByRole('button', { name: 'Create issue' }).click()
    await expect(dialog.getByText('Title is required')).toBeVisible()
  })

  test('a fast second submit does not create a duplicate issue (ISS-1)', async ({
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
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    const title = dialog.getByLabel('Issue title')
    const total = async () => (await listIssues(api, user, workspace.id)).total

    // Cmd+Enter pressed three times quickly.
    await page.locator('body').click()
    await page.keyboard.press('c')
    await title.fill('Double submit')
    await title.press('ControlOrMeta+Enter')
    await title.press('ControlOrMeta+Enter')
    await title.press('ControlOrMeta+Enter')
    await expect(dialog).toBeHidden()
    await page.waitForLoadState('networkidle')
    expect(await total()).toBe(1)

    // A double-click on "Create issue".
    await page.locator('body').click()
    await page.keyboard.press('c')
    await title.fill('Double click')
    await dialog.getByRole('button', { name: 'Create issue' }).dblclick()
    await expect(dialog).toBeHidden()
    await page.waitForLoadState('networkidle')
    expect(await total()).toBe(2)

    // "Create more" on, Cmd+Enter twice: one issue, the modal stays open.
    await page.locator('body').click()
    await page.keyboard.press('c')
    await dialog.getByRole('switch', { name: 'Create more' }).click()
    await title.fill('Create more twice')
    await title.press('ControlOrMeta+Enter')
    await title.press('ControlOrMeta+Enter')
    await expect(page.getByText('Created ENG-3')).toBeVisible()
    await expect(title).toHaveValue('')
    await page.waitForLoadState('networkidle')
    expect(await total()).toBe(3)
    const titles = (await listIssues(api, user, workspace.id)).items.map(i => i.title).sort()
    expect(titles).toEqual(['Create more twice', 'Double click', 'Double submit'])
  })

  test('the parent picker searches every issue of the team, not only the latest 100 (ISS-1)', async ({
    api,
    user,
    loginAs,
  }) => {
    test.slow() // seeds 101 issues
    const { workspace, team, key } = await seedWorkspace(api, user)
    const oldest = await createIssue(api, user, { team_id: team.id, title: 'Oldest parent' })
    for (let i = 1; i <= 100; i++) {
      await createIssue(api, user, { team_id: team.id, title: `Filler ${i}` })
    }
    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(row(page, 'Filler 100')).toBeVisible()
    await page.locator('body').click()
    await page.keyboard.press('c')
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await expect(dialog).toBeVisible()

    // A long assignee name stays on one line inside its chip.
    await dialog.getByRole('button', { name: /^Assignee:/ }).click()
    await page.getByRole('option', { name: user.email }).click()
    const assigneeChip = dialog.getByRole('button', { name: `Assignee: ${user.email}` })
    expect((await assigneeChip.boundingBox())!.height).toBeLessThanOrEqual(30)

    // ENG-1 is outside the first page of candidates: the search finds it on the server.
    await dialog.getByRole('button', { name: 'Parent issue: none' }).click()
    await page.getByPlaceholder('Set parent issue...').fill('Oldest')
    await page.getByRole('option', { name: 'ENG-1 Oldest parent' }).click()
    await expect(dialog.getByRole('button', { name: 'Parent issue: ENG-1' })).toBeVisible()
    await dialog.getByLabel('Issue title').fill('Child of the oldest')
    await dialog.getByRole('button', { name: 'Create issue' }).click()
    await expect(page.getByText('Created ENG-102')).toBeVisible()
    const response = await api.get(`/workspaces/${workspace.id}/issues/by-identifier/ENG-102`, {
      headers: authHeaders(user),
    })
    expect(((await response.json()) as Issue).parent_id).toBe(oldest.id)

    // "Create sub-issue with all properties" on ENG-1 shows the parent in the chip.
    await page.goto(`/${key}/issue/ENG-1`)
    await expect(page.getByRole('textbox', { name: 'Issue title' })).toHaveValue('Oldest parent')
    await page.getByRole('button', { name: /^Add sub-issues?$/ }).click()
    await page.getByRole('button', { name: 'Create sub-issue with all properties' }).click()
    await expect(dialog.getByRole('button', { name: 'Parent issue: ENG-1' })).toBeVisible()
  })

  test('a long title with no spaces wraps inside the create modal (ISS-1)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { key } = await seedWorkspace(api, user)
    const page = await loginAs(user)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByText('No issues yet')).toBeVisible()
    await page.locator('body').click()
    await page.keyboard.press('c')
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await expect(dialog).toBeVisible()

    const inside = async () => {
      const box = (await dialog.boundingBox())!
      for (const part of [
        dialog.getByLabel('Issue title'),
        dialog.getByRole('button', { name: 'Create issue' }),
        dialog.getByRole('button', { name: 'Close' }),
      ]) {
        const b = (await part.boundingBox())!
        expect(b.x).toBeGreaterThanOrEqual(box.x)
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
      }
    }
    await dialog
      .getByLabel('Issue title')
      .fill(
        'https://example.com/a/very/long/url/without/any/spaces/at/all/that/keeps/going/and/going/forever/and/ever'
      )
    await inside()
    await dialog.getByLabel('Issue title').fill('L'.repeat(600))
    await inside()
    const viewport = page.viewportSize()!
    const button = (await dialog.getByRole('button', { name: 'Create issue' }).boundingBox())!
    expect(button.y + button.height).toBeLessThanOrEqual(viewport.height)
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

    // A second Escape (no menu open) closes the modal: with text typed, it asks first.
    await page.keyboard.press('Escape')
    const prompt = page.getByRole('alertdialog', { name: 'Save issue as draft?' })
    await prompt.getByRole('button', { name: 'Discard' }).click()
    await expect(dialog).toBeHidden()
    await expect(prompt).toBeHidden()

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

  test('closing the modal with text typed asks to save a draft (ISS-1)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { workspace, key } = await seedWorkspace(api, user)
    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByText('No issues yet')).toBeVisible()

    const dialog = page.getByRole('dialog', { name: 'New issue' })
    const prompt = page.getByRole('alertdialog', { name: 'Save issue as draft?' })
    const title = dialog.getByLabel('Issue title')
    const description = dialog.getByRole('textbox', { name: 'Issue description' })

    // Nothing typed: Escape closes at once.
    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(prompt).toBeHidden()

    // Text typed: Escape asks; Escape on the prompt goes back to the modal.
    await page.keyboard.press('c')
    await title.fill('Half written issue')
    await description.click()
    await page.keyboard.type('Notes I do not want to lose')
    await dialog.getByRole('button', { name: /^Priority:/ }).click()
    await page.getByRole('option', { name: 'Urgent' }).click()
    await expect(dialog.getByRole('button', { name: 'Priority: Urgent' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(prompt).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(prompt).toBeHidden()
    await expect(dialog).toBeVisible()
    await expect(title).toHaveValue('Half written issue')

    // "Save draft" from the X button; the draft survives a reload.
    await dialog.getByRole('button', { name: 'Close' }).click()
    await prompt.getByRole('button', { name: 'Save draft' }).click()
    await expect(dialog).toBeHidden()
    await page.reload()
    await expect(page.getByText('No issues yet')).toBeVisible()
    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(title).toHaveValue('Half written issue')
    await expect(description).toContainText('Notes I do not want to lose')
    await expect(dialog.getByRole('button', { name: 'Priority: Urgent' })).toBeVisible()

    // Creating the issue uses the draft up.
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.getByText('Created ENG-1')).toBeVisible()
    await expect(row(page, 'Half written issue')).toBeVisible()
    const [issue] = (await listIssues(api, user, workspace.id)).items
    expect(issue).toMatchObject({ title: 'Half written issue', priority: 1 })
    expect(issue.description).toContain('Notes I do not want to lose')
    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(title).toHaveValue('')

    // "Discard" drops the text: the next modal is empty.
    await title.fill('Throwaway')
    await page.keyboard.press('Escape')
    await prompt.getByRole('button', { name: 'Discard' }).click()
    await expect(dialog).toBeHidden()
    await expect(prompt).toBeHidden()
    await page.keyboard.press('c')
    await expect(title).toHaveValue('')
  })

  test('a draft whose project was deleted since still creates the issue (ISS-1)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { workspace, team, key } = await seedWorkspace(api, user)
    const project = await createProject(api, user, {
      workspace_id: workspace.id,
      name: 'Short lived',
      team_ids: [team.id],
    })
    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByText('No issues yet')).toBeVisible()

    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await page.locator('body').click()
    await page.keyboard.press('c')
    await dialog.getByLabel('Issue title').fill('Drafted with a project')
    await dialog.getByRole('button', { name: /^Project:/ }).click()
    await page.getByRole('option', { name: 'Short lived' }).click()
    await expect(dialog.getByRole('button', { name: 'Project: Short lived' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await page
      .getByRole('alertdialog', { name: 'Save issue as draft?' })
      .getByRole('button', { name: 'Save draft' })
      .click()
    await expect(dialog).toBeHidden()

    const deleted = await api.delete(`/projects/${project.id}`, { headers: authHeaders(user) })
    expect(deleted.ok()).toBe(true)
    await page.reload()
    await expect(page.getByText('No issues yet')).toBeVisible()
    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(dialog.getByLabel('Issue title')).toHaveValue('Drafted with a project')
    await expect(dialog.getByRole('button', { name: 'Project: none' })).toBeVisible()

    // The create sends what the chips show (no project), not the deleted id.
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.getByText('Created ENG-1')).toBeVisible()
    await expect(dialog).toBeHidden()
    const [issue] = (await listIssues(api, user, workspace.id)).items
    expect(issue).toMatchObject({ title: 'Drafted with a project', project_id: null })
  })

  test('a new issue from the Backlog tab starts in the backlog (ISS-1, ISS-13)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { workspace, key } = await seedWorkspace(api, user)
    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues?tab=backlog`)
    await expect(page.getByText('No issues in the backlog')).toBeVisible()

    // The empty state's button and the C key both prefill the Backlog status.
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await page.getByRole('main').getByRole('button', { name: 'Create issue' }).click()
    await expect(dialog.getByRole('button', { name: 'Status: Backlog' })).toBeVisible()
    await dialog.getByLabel('Issue title').fill('Someday idea')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(dialog).toBeHidden()
    await expect(row(page, 'Someday idea')).toBeVisible()

    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(dialog.getByRole('button', { name: 'Status: Backlog' })).toBeVisible()
    await dialog.getByLabel('Issue title').fill('Another idea')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(row(page, 'Another idea')).toBeVisible()
    const { items } = await listIssues(api, user, workspace.id)
    expect(items.map(issue => issue.state.name)).toEqual(['Backlog', 'Backlog'])

    // The other tabs keep the team's default status (Todo).
    await page.getByRole('tab', { name: 'Active' }).click()
    await page.locator('body').click()
    await page.keyboard.press('c')
    await expect(dialog.getByRole('button', { name: 'Status: Todo' })).toBeVisible()
  })

  test('keeps a pasted multi-line title on one line (ISS-1)', async ({ api, user, loginAs }) => {
    const { workspace, key } = await seedWorkspace(api, user)
    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByText('No issues yet')).toBeVisible()

    await page.locator('body').click()
    await page.keyboard.press('c')
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    const title = dialog.getByLabel('Issue title')
    // fill() sets the value with one input event, like a paste.
    await title.fill('multi\nline title')
    await expect(title).toHaveValue('multi line title')
    // Line breaks with spaces around them become one space.
    await title.fill('first \r\n\n  second')
    await expect(title).toHaveValue('first second')
    await title.press('ControlOrMeta+Enter')
    await expect(dialog).toBeHidden()
    await expect(row(page, 'first second')).toBeVisible()

    const [issue] = (await listIssues(api, user, workspace.id)).items
    expect(issue.title).toBe('first second')
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

  test('the light theme keeps light state colors visible on white (Todo #e2e2e2)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, states, key } = await seedWorkspace(api, user)
    expect(states.Todo.color).toBe('#e2e2e2')
    await createIssue(api, user, { team_id: team.id, title: 'Todo work' })

    /** Contrast ratio against white of every Todo status icon in the page (WCAG formula). */
    const todoIconContrasts = (page: Page) =>
      page.locator('svg[data-status-type="unstarted"]').evaluateAll(icons =>
        icons.map(icon => {
          // A canvas resolves any CSS color (oklch, relative colors) to sRGB.
          const ctx = document.createElement('canvas').getContext('2d')!
          ctx.fillStyle = getComputedStyle(icon).color
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data).map(v => {
            const c = v / 255
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
          })
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
          return 1.05 / (luminance + 0.05)
        })
      )

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(page.getByRole('group', { name: 'Todo' })).toContainText('Todo work')

    // Dark theme (default): the stored color is drawn as-is (light on a dark surface).
    const dark = await todoIconContrasts(page)
    expect(dark.length).toBeGreaterThan(0)
    for (const ratio of dark) expect(ratio).toBeLessThan(1.5)

    await page.evaluate(() => localStorage.setItem('theme', 'light'))
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/light/)
    await expect(page.getByRole('group', { name: 'Todo' })).toContainText('Todo work')

    // Light theme: group header, row and status chip icons reach 3:1 (WCAG non-text).
    const light = await todoIconContrasts(page)
    expect(light.length).toBe(dark.length)
    for (const ratio of light) expect(ratio).toBeGreaterThanOrEqual(3)

    // The create-issue modal's status button too.
    await page.getByRole('button', { name: 'New issue' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await expect(dialog.getByRole('button', { name: 'Status: Todo' })).toBeVisible()
    const withModal = await todoIconContrasts(page)
    expect(withModal.length).toBeGreaterThan(light.length)
    for (const ratio of withModal) expect(ratio).toBeGreaterThanOrEqual(3)
  })

  test('the light theme shows the row hover and keyboard focus on white', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, key } = await seedWorkspace(api, user)
    await createIssue(api, user, { team_id: team.id, title: 'Hover one' })
    await createIssue(api, user, { team_id: team.id, title: 'Hover two' })

    /** The row background as drawn over the white list surface (sRGB 0..255). */
    const drawnBackground = (title: string) =>
      row(page, title).evaluate(element => {
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 1, 1)
        ctx.fillStyle = getComputedStyle(element).backgroundColor
        ctx.fillRect(0, 0, 1, 1)
        return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
      })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await page.evaluate(() => localStorage.setItem('theme', 'light'))
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/light/)
    await expect(row(page, 'Hover two')).toBeVisible()
    expect(await drawnBackground('Hover two')).toEqual([255, 255, 255])

    await row(page, 'Hover two').hover()
    expect(await drawnBackground('Hover two')).not.toEqual([255, 255, 255])

    await page.mouse.move(0, 0)
    await issueList(page).focus()
    await page.keyboard.press('j')
    await expect(issueList(page)).toHaveAttribute('aria-activedescendant', /.+/)
    expect(await drawnBackground('Hover one')).not.toEqual([255, 255, 255])
  })

  test('the bulk action bar fits a phone screen (ISS-14)', async ({ api, user, loginAs }) => {
    const { team, key } = await seedWorkspace(api, user)
    for (const title of ['Phone one', 'Phone two', 'Phone three', 'Phone four']) {
      await createIssue(api, user, { team_id: team.id, title })
    }

    const page = await loginAs(user)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${key}/team/ENG/issues`)
    await row(page, 'Phone one').getByRole('checkbox', { name: 'Select row' }).click()
    const bar = page.getByRole('toolbar', { name: 'Bulk actions' })
    await expect(bar).toContainText('1 issue selected')

    // Every control of the bar is inside the viewport.
    const controls = [
      bar.getByRole('button', { name: 'Clear selection' }),
      ...['Status', 'Priority', 'Assignee', 'Label', 'Archive', 'Delete'].map(name =>
        bar.getByRole('button', { name })
      ),
    ]
    for (const control of controls) {
      const box = (await control.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
      expect(box.y + box.height).toBeLessThanOrEqual(844)
    }

    // The last row scrolls out from under the bar.
    await issueList(page).evaluate(list => (list.scrollTop = list.scrollHeight))
    const last = (await row(page, 'Phone four').boundingBox())!
    const barBox = (await bar.boundingBox())!
    expect(last.y + last.height).toBeLessThanOrEqual(barBox.y)

    await bar.getByRole('button', { name: 'Clear selection' }).click()
    await expect(bar).toBeHidden()
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
    await page.getByRole('option', { name: 'Urgent', exact: true }).click()
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
    await page.getByRole('option', { name: 'Bug', exact: true }).click()
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

  test('Clear filters in the empty state also clears the search box (ISS-5)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, key } = await seedWorkspace(api, user)
    await createIssue(api, user, { team_id: team.id, title: 'Polish header' })
    await createIssue(api, user, { team_id: team.id, title: 'Crash on save' })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(row(page, 'Polish header')).toBeVisible()

    const search = page.getByLabel('Search issues')
    await search.fill('zzz')
    await expect(page).toHaveURL(/q=zzz/)
    await expect(page.getByText('No issues match')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(search).toHaveValue('')
    await expect(row(page, 'Polish header')).toBeVisible()
    await expect(row(page, 'Crash on save')).toBeVisible()

    // The next keystroke starts a new search; the old text does not come back.
    await search.pressSequentially('c')
    await expect(page).toHaveURL(/q=c(&|$)/)
    await expect(search).toHaveValue('c')
    await expect(row(page, 'Crash on save')).toBeVisible()
  })

  test('the "+" of a priority group prefills the priority of the new issue (ISS-5)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, key } = await seedWorkspace(api, user)
    await createIssue(api, user, { team_id: team.id, title: 'Existing medium', priority: 3 })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues?group=priority`)
    await expect(row(page, 'Existing medium')).toBeVisible()

    await page.getByRole('button', { name: 'Add to Medium' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Priority: Medium' })).toBeVisible()
    await dialog.getByPlaceholder('Issue title').fill('Prefilled medium')
    await page.keyboard.press('ControlOrMeta+Enter')

    await expect(page.getByRole('group', { name: 'Medium' })).toContainText('Prefilled medium')
    const { items } = await listIssues(api, user, team.workspace_id)
    expect(items.find(issue => issue.title === 'Prefilled medium')?.priority).toBe(3)
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

  test('a card dropped at the bottom of a column does not tie with another column (ISS-4)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, states, key } = await seedWorkspace(api, user)
    const moved = await createIssue(api, user, {
      team_id: team.id,
      title: 'Moved card',
      state_id: states.Backlog.id,
    })
    const todo = await createIssue(api, user, { team_id: team.id, title: 'Todo card' })
    const review = await createIssue(api, user, {
      team_id: team.id,
      title: 'Review card',
      state_id: states['In Review'].id,
    })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues?layout=board`)
    const board = page.getByRole('region', { name: 'Issue board' })
    const card = board.locator('[data-issue-card="ENG-1"]')
    const target = board.getByRole('region', { name: 'Todo' })
    await expect(target).toContainText('Todo card')

    const from = await card.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) throw new Error('board not laid out')
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 })
    // Below the column's only card: the bottom of the column.
    await page.mouse.move(to.x + to.width / 2, to.y + 300, { steps: 15 })
    await page.mouse.up()

    await expect.poll(async () => (await getIssue(api, user, moved.id)).state.name).toBe('Todo')
    // last + 1 would equal the In Review card's sort order.
    const sortOrder = (await getIssue(api, user, moved.id)).sort_order
    expect(sortOrder).toBeGreaterThan(todo.sort_order)
    expect(sortOrder).toBeLessThan(review.sort_order)

    await page.goto(`/${key}/team/ENG/issues?group=none`)
    await expect(issueList(page).getByRole('option')).toHaveText([
      /Todo card/,
      /Moved card/,
      /Review card/,
    ])
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

  test('Escape clears the selection wherever the focus is (ISS-14)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, key } = await seedWorkspace(api, user)
    const one = await createIssue(api, user, { team_id: team.id, title: 'Esc one' })
    const two = await createIssue(api, user, { team_id: team.id, title: 'Esc two' })
    await createIssue(api, user, { team_id: team.id, title: 'Esc three' })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    const bar = page.getByRole('toolbar', { name: 'Bulk actions' })

    // After a bulk action the focus is on the bar button: Escape still clears.
    await row(page, 'Esc one').click({ modifiers: ['ControlOrMeta'] })
    await row(page, 'Esc two').click({ modifiers: ['ControlOrMeta'] })
    await expect(bar).toContainText('2 issues selected')
    await bar.getByRole('button', { name: 'Priority' }).click()
    await page.getByRole('option', { name: 'Low' }).click()
    await expect.poll(async () => (await getIssue(api, user, one.id)).priority).toBe(4)
    expect((await getIssue(api, user, two.id)).priority).toBe(4)
    await expect(bar).toContainText('2 issues selected')
    await page.keyboard.press('Escape')
    await expect(bar).toBeHidden()
    await expect(row(page, 'Esc one')).toHaveAttribute('aria-selected', 'false')

    // Focus outside the list (page body after a click on the header): Escape clears.
    await row(page, 'Esc one').getByRole('checkbox', { name: 'Select row' }).click()
    await expect(bar).toContainText('1 issue selected')
    await page.getByRole('heading', { level: 1 }).click()
    await expect(issueList(page)).not.toBeFocused()
    await page.keyboard.press('Escape')
    await expect(bar).toBeHidden()

    // Escape that closes an open picker only closes the picker.
    await row(page, 'Esc two').getByRole('checkbox', { name: 'Select row' }).click()
    await bar.getByRole('button', { name: 'Status' }).click()
    await expect(page.getByRole('option', { name: 'Done' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('option', { name: 'Done' })).toBeHidden()
    await expect(bar).toContainText('1 issue selected')

    // A new selection after Escape does not include the old, hidden one.
    await page.keyboard.press('Escape')
    await expect(bar).toBeHidden()
    await row(page, 'Esc three').click({ modifiers: ['ControlOrMeta'] })
    await expect(bar).toContainText('1 issue selected')
  })

  test('the bulk bar does not cover the last row (ISS-14)', async ({ api, user, loginAs }) => {
    const { team, key } = await seedWorkspace(api, user)
    for (let n = 1; n <= 24; n++) {
      await createIssue(api, user, { team_id: team.id, title: `Long list ${n}` })
    }

    const page = await loginAs(user)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/${key}/team/ENG/issues`)
    const list = issueList(page)
    await row(page, 'Long list 7').getByRole('checkbox', { name: 'Select row' }).click()
    const bar = page.getByRole('toolbar', { name: 'Bulk actions' })
    await expect(bar).toContainText('1 issue selected')

    // The list must scroll, else the test proves nothing.
    expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
    await list.evaluate(el => el.scrollTo(0, el.scrollHeight))

    const last = list.getByRole('option').last()
    await expect(async () => {
      const rowBox = await last.boundingBox()
      const barBox = await bar.boundingBox()
      if (!rowBox || !barBox) throw new Error('not laid out')
      expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(barBox.y)
    }).toPass()
    // The last row is clickable: the bar is not on top of it.
    await last.click({ trial: true })
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

  test('focus goes back to the list after an inline picker closes (ISS-2, ISS-12)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, states, key } = await seedWorkspace(api, user)
    const created = [
      await createIssue(api, user, { team_id: team.id, title: 'Focus one' }),
      await createIssue(api, user, { team_id: team.id, title: 'Focus two' }),
      await createIssue(api, user, { team_id: team.id, title: 'Focus three' }),
    ]
    const activeIssue = async (page: Page) => {
      const domId = await issueList(page).getAttribute('aria-activedescendant')
      return created.find(issue => domId?.endsWith(issue.id))
    }

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(row(page, 'Focus three')).toBeVisible()
    // The list gets focus on load: this test never calls focus() by hand.
    await expect(issueList(page)).toBeFocused()

    // Keyboard: P, then ArrowDown + Enter picks an option. Focus is on the list again.
    await page.keyboard.press('j')
    await expect.poll(async () => (await activeIssue(page))?.id).toBeTruthy()
    const picked = await activeIssue(page)
    await page.keyboard.press('p')
    const priority = page.getByRole('combobox', { name: 'Priority' })
    await expect(priority).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(priority).toBeHidden()
    await expect(issueList(page)).toBeFocused()
    await expect
      .poll(async () => (await getIssue(api, user, picked?.id ?? '')).priority)
      .not.toBe(0)

    // J moves to another row, A opens the assignee picker, Esc closes it.
    const before = await activeIssue(page)
    await page.keyboard.press('j')
    await expect.poll(async () => (await activeIssue(page))?.id).not.toBe(before?.id)
    const next = await activeIssue(page)
    await page.keyboard.press('a')
    const assignee = page.getByRole('combobox', { name: 'Assignee' })
    await expect(assignee).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(assignee).toBeHidden()
    await expect(issueList(page)).toBeFocused()

    // Mouse pick in a row: focus goes back to the list too, so S opens a picker
    // and Enter cannot reopen the row's picker and change a status by accident.
    await row(page, 'Focus three').getByRole('button', { name: 'Status: Todo' }).click()
    await page.getByRole('option', { name: 'In Progress' }).click()
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeHidden()
    await expect(issueList(page)).toBeFocused()
    await expect
      .poll(async () => (await getIssue(api, user, created[2].id)).state.name)
      .toBe('In Progress')
    await page.keyboard.press('s')
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(issueList(page)).toBeFocused()

    // Enter opens the focused issue (it does not reopen a picker).
    const focused = await activeIssue(page)
    expect(focused?.id).toBe(next?.id)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/${key}/issue/${focused?.identifier}`)
    for (const issue of created.slice(0, 2)) {
      expect((await getIssue(api, user, issue.id)).state.id).toBe(states.Todo.id)
    }
  })

  test('focus goes back to the list after the context menu and the delete dialog (ISS-2, ISS-12)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { workspace, team, key } = await seedWorkspace(api, user)
    const one = await createIssue(api, user, { team_id: team.id, title: 'Menu one' })
    const two = await createIssue(api, user, { team_id: team.id, title: 'Menu two' })
    await createIssue(api, user, { team_id: team.id, title: 'Menu three' })

    const page = await loginAs(user)
    await page.goto(`/${key}/team/ENG/issues`)
    await expect(row(page, 'Menu three')).toBeVisible()
    await expect(issueList(page)).toBeFocused()

    // A context-menu action: the right-clicked row is focused and the list
    // keeps the keyboard, so P acts on that row.
    await row(page, 'Menu two').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Priority' }).hover()
    await page.getByRole('menuitemcheckbox', { name: 'High' }).click()
    await expect.poll(async () => (await getIssue(api, user, two.id)).priority).toBe(2)
    await expect(issueList(page)).toBeFocused()
    await expect(issueList(page)).toHaveAttribute('aria-activedescendant', new RegExp(two.id))
    await page.keyboard.press('p')
    await expect(page.getByRole('combobox', { name: 'Priority' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('combobox', { name: 'Priority' })).toBeHidden()
    await expect(issueList(page)).toBeFocused()

    // Cmd+Backspace, then cancel: J/K still work.
    await page.keyboard.press('k')
    await expect(issueList(page)).toHaveAttribute('aria-activedescendant', new RegExp(one.id))
    await page.keyboard.press('ControlOrMeta+Backspace')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toBeHidden()
    await expect(issueList(page)).toBeFocused()

    // Cmd+Backspace, then Delete: the list has the keyboard again.
    await page.keyboard.press('ControlOrMeta+Backspace')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(row(page, 'Menu one')).toBeHidden()
    await expect.poll(async () => (await listIssues(api, user, workspace.id)).total).toBe(2)
    await expect(issueList(page)).toBeFocused()
    await page.keyboard.press('j')
    await expect(issueList(page)).toHaveAttribute('aria-activedescendant', /.+/)
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

  test('my issues drops filters a tab hides when switching tabs (ISS-13)', async ({
    api,
    user,
    loginAs,
  }) => {
    const { team, key } = await seedWorkspace(api, user)
    const me = await getMe(api, user)
    await createIssue(api, user, { team_id: team.id, title: 'Mine to do', assignee_id: me.id })
    await createIssue(api, user, { team_id: team.id, title: 'Written by me' })

    const page = await loginAs(user)
    await page.goto(`/${key}/my-issues?tab=created`)
    await expect(row(page, 'Mine to do')).toBeVisible()

    // An assignee filter on the Created tab.
    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('menuitem', { name: 'Assignee' }).click()
    await page.getByRole('option', { name: 'No assignee' }).click()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/assignee=none/)
    await expect(row(page, 'Written by me')).toBeVisible()
    await expect(row(page, 'Mine to do')).toBeHidden()

    // The Assigned tab hides the assignee filter: switching drops it.
    await page.getByRole('tab', { name: 'Assigned' }).click()
    await expect(page).toHaveURL(`/${key}/my-issues`)
    await expect(row(page, 'Mine to do')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Assignee filter' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0)

    // A link that carries a hidden filter does not apply it either.
    await page.goto(`/${key}/my-issues?assignee=none`)
    await expect(row(page, 'Mine to do')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Assignee filter' })).toHaveCount(0)
  })
})
