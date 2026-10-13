/**
 * Projects (PRJ-1..3): the workspace and team project lists, the "New project"
 * dialog, the project page (inline edits, description autosave, issues tab)
 * and delete. Everything runs against the real backend.
 */
import {
  type Page,
  addFavorite,
  addWorkspaceMember,
  createIssue,
  createProject,
  createWorkspace,
  errorToast,
  expect,
  getIssue,
  getMe,
  getProject,
  listMembers,
  listProjects,
  listStates,
  listTeams,
  registerUser,
  removeMember,
  test,
  updateIssue,
  updateProject,
} from './fixtures'

function projectRow(page: Page, name: string) {
  return page.getByTestId('project-row').filter({ hasText: name })
}

test('a new workspace shows the empty projects state', async ({ authedPage: page, api, user }) => {
  const workspace = await createWorkspace(api, user)
  await page.goto(`/${workspace.url_key}/projects`)
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible()
  await expect(page.getByText('No projects yet')).toBeVisible()
})

test('creates a project with every field through the dialog', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const me = await getMe(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  await page.goto(`/${workspace.url_key}/projects`)

  await page.getByRole('button', { name: 'New project' }).click()
  const dialog = page.getByRole('dialog', { name: 'New project' })
  await expect(dialog.getByLabel('Project name')).toBeFocused()

  // The name is required.
  await dialog.getByRole('button', { name: 'Create project' }).click()
  await expect(dialog.getByText('Project name is required')).toBeVisible()

  await dialog.getByLabel('Project name').fill('Mobile launch')
  await dialog.getByRole('textbox', { name: 'Project description' }).click()
  await page.keyboard.type('Ship the app to the stores.')

  await dialog.getByRole('button', { name: 'Change project icon' }).click()
  await page.getByRole('button', { name: 'Icon rocket' }).click()
  await page.getByRole('button', { name: 'Color #4cb782' }).click()
  await page.keyboard.press('Escape')

  await dialog.getByRole('button', { name: 'Status: Planned' }).click()
  await page.getByRole('option', { name: 'In Progress' }).click()
  await dialog.getByRole('button', { name: 'Lead: none' }).click()
  await page.getByRole('option', { name: me.display_name || me.email }).click()
  await dialog.getByRole('button', { name: 'Start date: none' }).click()
  await page.getByLabel('Start date', { exact: true }).fill('2026-11-01')
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Target date: none' }).click()
  await page.getByLabel('Target date', { exact: true }).fill('2026-12-31')
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Teams: none' }).click()
  await page.getByRole('option', { name: team.name }).click()
  await page.keyboard.press('Escape')

  await dialog.getByRole('button', { name: 'Create project' }).click()
  await expect(dialog).toBeHidden()

  const [project] = await listProjects(api, user, workspace.id)
  await expect(page).toHaveURL(`/${workspace.url_key}/project/${project.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Mobile launch' })).toBeVisible()
  expect(project).toMatchObject({
    name: 'Mobile launch',
    status: 'started',
    lead_id: me.id,
    start_date: '2026-11-01',
    target_date: '2026-12-31',
    team_ids: [team.id],
    icon: 'rocket',
    color: '#4cb782',
  })
  expect(project.description).toContain('Ship the app to the stores.')
})

test('lists projects with progress, filters by status tab and by team', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const me = await getMe(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const states = await listStates(api, user, team.id)
  const done = states.find(s => s.type === 'completed')!
  const canceled = states.find(s => s.type === 'canceled')!

  const launch = await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'Launch',
    status: 'started',
    lead_id: me.id,
    target_date: '2026-12-31',
    team_ids: [team.id],
  })
  await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'Archive',
    status: 'completed',
  })
  await createIssue(api, user, { team_id: team.id, title: 'A', project_id: launch.id })
  await createIssue(api, user, {
    team_id: team.id,
    title: 'B',
    project_id: launch.id,
    state_id: done.id,
  })
  await createIssue(api, user, {
    team_id: team.id,
    title: 'C',
    project_id: launch.id,
    state_id: canceled.id,
  })

  await page.goto(`/${workspace.url_key}/projects`)
  const row = projectRow(page, 'Launch')
  await expect(row).toContainText('In Progress')
  await expect(row).toContainText('50%')
  await expect(row).toContainText('Dec 31')
  await expect(row).toContainText(team.name)
  await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  await expect(projectRow(page, 'Archive')).toContainText('0%')
  await expect(page.getByRole('tab', { name: /All projects/ })).toContainText('2')

  await page.getByRole('tab', { name: /Completed/ }).click()
  await expect(page).toHaveURL(`/${workspace.url_key}/projects?status=completed`)
  await expect(projectRow(page, 'Archive')).toBeVisible()
  await expect(projectRow(page, 'Launch')).toBeHidden()

  await page.getByRole('tab', { name: /Paused/ }).click()
  await expect(page.getByText('No projects with this status')).toBeVisible()

  // The team page only lists projects of the team; the API filters the same way.
  await page.goto(`/${workspace.url_key}/team/${team.key}/projects`)
  await expect(projectRow(page, 'Launch')).toBeVisible()
  await expect(projectRow(page, 'Archive')).toBeHidden()
  expect(
    (await listProjects(api, user, workspace.id, `?team_id=${team.id}`)).map(p => p.name)
  ).toEqual(['Launch'])
  expect(
    (await listProjects(api, user, workspace.id, '?status=completed')).map(p => p.name)
  ).toEqual(['Archive'])

  await projectRow(page, 'Launch').click()
  await expect(page).toHaveURL(`/${workspace.url_key}/project/${launch.id}`)
})

test('edits a project inline and autosaves the description', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Draft' })
  await page.goto(`/${workspace.url_key}/project/${project.id}`)

  const name = page.getByLabel('Project name')
  await name.fill('Website redesign')
  await name.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Website redesign' })).toBeVisible()

  await page.getByRole('button', { name: 'Status: Planned' }).click()
  await page.getByRole('option', { name: 'Paused' }).click()
  await expect(page.getByRole('button', { name: 'Status: Paused' })).toBeVisible()

  await page.getByRole('button', { name: 'Target date: none' }).click()
  await page.getByLabel('Target date', { exact: true }).fill('2027-03-15')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Target date: Mar 15/ })).toBeVisible()

  await page.getByRole('textbox', { name: 'Project description' }).click()
  await page.keyboard.type('Goals for the new site')
  // Dirty content shows "Unsaved" during the debounce, never a stale "Saved".
  await expect(page.getByText('Unsaved')).toBeVisible()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await expect
    .poll(async () => (await getProject(api, user, project.id))?.description ?? '')
    .toContain('Goals for the new site')
  expect(await getProject(api, user, project.id)).toMatchObject({
    name: 'Website redesign',
    status: 'paused',
    target_date: '2027-03-15',
  })

  // The target date can be cleared again.
  await page.getByRole('button', { name: /Target date: Mar 15/ }).click()
  await page.getByRole('button', { name: 'Clear target date' }).click()
  await expect(page.getByRole('button', { name: 'Target date: none' })).toBeVisible()
  await expect.poll(async () => (await getProject(api, user, project.id))?.target_date).toBeNull()
})

test('typing a date with the keyboard on the project page saves the full year', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Dates' })
  await page.goto(`/${workspace.url_key}/project/${project.id}`)

  // The date is typed segment by segment (MM DD YYYY). Each year digit makes a
  // valid date ("0002-11-20", "0026-11-20"): none of them may be saved.
  await page.getByRole('button', { name: 'Start date: none' }).click()
  const start = page.getByLabel('Start date', { exact: true })
  await start.focus()
  await page.keyboard.type('11202026')
  await expect(start).toHaveValue('2026-11-20')
  expect((await getProject(api, user, project.id))?.start_date).toBeNull()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^Start date: Nov 20(, 2026)?$/ })).toBeVisible()

  // Enter also saves the typed date.
  await page.getByRole('button', { name: 'Target date: none' }).click()
  const target = page.getByLabel('Target date', { exact: true })
  await target.focus()
  await page.keyboard.type('03152027')
  await expect(target).toHaveValue('2027-03-15')
  await target.press('Enter')
  await expect(page.getByRole('button', { name: 'Target date: Mar 15, 2027' })).toBeVisible()

  await expect
    .poll(async () => (await getProject(api, user, project.id))?.target_date)
    .toBe('2027-03-15')
  expect(await getProject(api, user, project.id)).toMatchObject({
    start_date: '2026-11-20',
    target_date: '2027-03-15',
  })

  // After a reload the chips still show the saved years.
  await page.reload()
  await expect(page.getByRole('button', { name: /^Start date: Nov 20(, 2026)?$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Target date: Mar 15, 2027' })).toBeVisible()
})

test('the project page keeps the target date on or after the start date', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const project = await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'Launch',
    start_date: '2027-03-01',
    target_date: '2027-03-31',
  })
  await page.goto(`/${workspace.url_key}/project/${project.id}`)

  // A target date before the start date is refused in the picker.
  await page.getByRole('button', { name: /Target date: Mar 31/ }).click()
  const target = page.getByLabel('Target date', { exact: true })
  await expect(target).toHaveAttribute('min', '2027-03-01')
  await target.fill('2027-02-01')
  await expect(page.getByRole('alert')).toHaveText(
    'The target date must not be before the start date'
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Target date: Mar 31/ })).toBeVisible()

  // So is a start date after the target date.
  await page.getByRole('button', { name: /Start date: Mar 1/ }).click()
  const start = page.getByLabel('Start date', { exact: true })
  await expect(start).toHaveAttribute('max', '2027-03-31')
  await start.fill('2027-04-15')
  await expect(page.getByRole('alert')).toHaveText(
    'The start date must not be after the target date'
  )
  // The same day is allowed.
  await start.fill('2027-03-31')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Start date: Mar 31/ })).toBeVisible()
  await expect
    .poll(async () => (await getProject(api, user, project.id))?.start_date)
    .toBe('2027-03-31')
  expect((await getProject(api, user, project.id))?.target_date).toBe('2027-03-31')

  // The backend refuses it too: here the start date moved after the page loaded.
  await updateProject(api, user, project.id, {
    start_date: '2027-05-01',
    target_date: '2027-05-31',
  })
  await page.getByRole('button', { name: /Target date: Mar 31/ }).click()
  await page.getByLabel('Target date', { exact: true }).fill('2027-04-10')
  await expect(page.getByText('Could not update project')).toBeVisible()
  await expect(
    page.getByText('target_date: The target date must not be before the start date')
  ).toBeVisible()
  expect(await getProject(api, user, project.id)).toMatchObject({
    start_date: '2027-05-01',
    target_date: '2027-05-31',
  })
})

test('shows progress and the issues of a project; New issue opens the create modal', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const states = await listStates(api, user, team.id)
  const done = states.find(s => s.type === 'completed')!
  const project = await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'API v2',
    team_ids: [team.id],
  })
  const first = await createIssue(api, user, {
    team_id: team.id,
    title: 'Design endpoints',
    project_id: project.id,
  })
  await createIssue(api, user, { team_id: team.id, title: 'Unrelated' })

  await page.goto(`/${workspace.url_key}/project/${project.id}`)
  const progress = page.getByRole('region', { name: 'Progress' })
  await expect(progress).toContainText('0 of 1 issues completed')

  await updateIssue(api, user, first.id, { state_id: done.id })
  await page.reload()
  await expect(progress).toContainText('1 of 1 issues completed')
  await expect(progress).toContainText('100%')

  await page.getByRole('tab', { name: /Issues/ }).click()
  await expect(page).toHaveURL(`/${workspace.url_key}/project/${project.id}?tab=issues`)
  // The Issues tab is the shared IssuesView, scoped to the project.
  const issues = page.getByRole('listbox', { name: 'Issues' })
  await expect(issues.getByRole('option', { name: /Design endpoints/ })).toBeVisible()
  await expect(page.getByText('Unrelated')).toBeHidden()

  await page.evaluate(() => {
    window.addEventListener('linear:create-issue', event => {
      document.body.dataset.createIssue = JSON.stringify((event as CustomEvent).detail)
    })
  })
  await page.getByRole('main').getByRole('button', { name: 'New issue' }).first().click()
  await expect(page.locator('body')).toHaveAttribute(
    'data-create-issue',
    JSON.stringify({ projectId: project.id, teamId: team.id })
  )
  const dialog = page.getByRole('dialog', { name: 'New issue' })
  await expect(dialog.getByRole('button', { name: `Project: ${project.name}` })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('deletes a project after confirmation and keeps its issues', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Old' })
  await updateProject(api, user, project.id, { name: 'Obsolete' })
  const issue = await createIssue(api, user, {
    team_id: team.id,
    title: 'Keep me',
    project_id: project.id,
  })

  await page.goto(`/${workspace.url_key}/project/${project.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Obsolete' })).toBeVisible()
  await page.getByRole('button', { name: 'Project options' }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Delete project?' })
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  expect(await getProject(api, user, project.id)).not.toBeNull()

  await page.getByRole('button', { name: 'Project options' }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  await confirm.getByRole('button', { name: 'Delete project' }).click()
  await expect(page).toHaveURL(`/${workspace.url_key}/projects`)
  await expect(page.getByText('No projects yet')).toBeVisible()
  expect(await getProject(api, user, project.id)).toBeNull()
  expect((await getIssue(api, user, issue.id)).project_id).toBeNull()

  // A deleted project's page shows "not found".
  await page.goto(`/${workspace.url_key}/project/${project.id}`)
  await expect(page.getByText('Project not found')).toBeVisible()
})

test('the sidebar favorite follows a project rename and goes away on delete', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Draft' })
  await addFavorite(api, user, {
    workspace_id: workspace.id,
    entity_type: 'project',
    entity_id: project.id,
  })

  await page.goto(`/${workspace.url_key}/project/${project.id}`)
  const favorites = page.getByRole('navigation', { name: 'Main' }).getByTestId('sidebar-favorite')
  await expect(favorites).toHaveCount(1)
  await expect(favorites.first()).toHaveText('Draft')

  // Rename: the favorite shows the new name without a reload.
  const name = page.getByLabel('Project name')
  await name.fill('Launch plan')
  await name.press('Enter')
  await expect(favorites.first()).toHaveText('Launch plan')

  // Delete: the favorite goes away without a reload, and the deleted project
  // is not fetched again (no 404 in the console).
  const notFound: string[] = []
  page.on('response', response => {
    if (response.status() === 404) notFound.push(response.url())
  })
  await page.getByRole('button', { name: 'Project options' }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  await page
    .getByRole('alertdialog', { name: 'Delete project?' })
    .getByRole('button', { name: 'Delete project' })
    .click()
  await expect(page).toHaveURL(`/${workspace.url_key}/projects`)
  await expect(page.getByText('No projects yet')).toBeVisible()
  await expect(favorites).toHaveCount(0)
  expect(notFound).toEqual([])
})

test('saves a project description typed just before a reload (keepalive flush on pagehide)', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const project = await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'Quick reload',
    description: '<p>Start</p>',
  })
  await page.goto(`/${workspace.url_key}/project/${project.id}`)

  const description = page.getByRole('textbox', { name: 'Project description' })
  await expect(description).toContainText('Start')
  await description.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' QUICKRELOAD')
  // Reload inside the 800 ms debounce: no React unmount runs.
  await page.reload()

  await expect
    .poll(async () => (await getProject(api, user, project.id))?.description)
    .toBe('<p>Start QUICKRELOAD</p>')
  await page.reload()
  await expect(description).toHaveText('Start QUICKRELOAD')
})

test('C on the project page creates the issue in the project', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const project = await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'Shortcut target',
    team_ids: [team.id],
  })

  await page.goto(`/${workspace.url_key}/project/${project.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Shortcut target' })).toBeVisible()
  await page.keyboard.press('c')
  const dialog = page.getByRole('dialog', { name: 'New issue' })
  await expect(dialog.getByRole('button', { name: 'Project: Shortcut target' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.getByRole('tab', { name: /Issues/ }).click()
  await expect(page.getByText('No issues in this project')).toBeVisible()
  await page.keyboard.press('c')
  await expect(dialog.getByRole('button', { name: 'Project: Shortcut target' })).toBeVisible()
  await page.keyboard.type('Filed with C')
  await dialog.getByRole('button', { name: /Create issue/ }).click()
  await expect(
    page.getByRole('listbox', { name: 'Issues' }).getByRole('option', { name: /Filed with C/ })
  ).toBeVisible()
})

test('a long project name does not push the issue title out of its row', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const project = await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'Longwordwithoutspaces'.repeat(12),
    team_ids: [team.id],
  })
  await createIssue(api, user, { team_id: team.id, title: 'Short title', project_id: project.id })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/${workspace.url_key}/team/${team.key}/issues`)
  const row = page.getByRole('listbox', { name: 'Issues' }).getByRole('option', {
    name: /Short title/,
  })
  await expect(row.getByText('Short title', { exact: true })).toBeVisible()
  // The project chip is truncated, with the full name as its tooltip.
  await expect(row.getByTitle(project.name)).toBeVisible()
})

test('a lead who left the workspace still shows on the project page', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const other = await registerUser(api)
  const lead = await addWorkspaceMember(api, user, workspace.id, other)
  const project = await createProject(api, user, {
    workspace_id: workspace.id,
    name: 'Orphaned lead',
    lead_id: lead.id,
  })
  const member = (await listMembers(api, user, workspace.id)).find(m => m.user_id === lead.id)!
  await removeMember(api, user, workspace.id, member.id)

  await page.goto(`/${workspace.url_key}/project/${project.id}`)
  await expect(
    page.getByRole('region', { name: 'Properties' }).getByRole('button', {
      name: `Lead: ${lead.display_name || lead.email}`,
    })
  ).toBeVisible()
})

test('a double click on Delete project deletes it without an error', async ({
  authedPage: page,
  api,
  user,
}) => {
  const workspace = await createWorkspace(api, user)
  const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Twice' })

  await page.goto(`/${workspace.url_key}/project/${project.id}`)
  await page.getByRole('button', { name: 'Project options' }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  await page
    .getByRole('alertdialog', { name: 'Delete project?' })
    .getByRole('button', { name: 'Delete project' })
    .dblclick()
  await expect(page).toHaveURL(`/${workspace.url_key}/projects`)
  await expect(page.getByText('Project deleted')).toBeVisible()
  await expect(errorToast(page)).toHaveCount(0)
})
