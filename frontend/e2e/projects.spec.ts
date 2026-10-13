/**
 * Projects (PRJ-1..3): the workspace and team project lists, the "New project"
 * dialog, the project page (inline edits, description autosave, issues tab)
 * and delete. Everything runs against the real backend.
 */
import {
  type Page,
  createIssue,
  createProject,
  createWorkspace,
  expect,
  getIssue,
  getMe,
  getProject,
  listProjects,
  listStates,
  listTeams,
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
  await expect(page.getByText('Saved')).toBeVisible()

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
  await expect(page.getByRole('link', { name: /Design endpoints/ })).toBeVisible()
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
