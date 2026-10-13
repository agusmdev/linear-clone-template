/**
 * Cross-slice flows wired at integration: the project page (Issues tab on the
 * shared IssuesView, Documents tab, favorites, live progress), documents moved
 * to a project, sub-issues from the full create modal, archive from the issue
 * list and the "?" shortcuts help.
 */
import {
  createDocument,
  createIssue,
  createProject,
  createWorkspace,
  expect,
  fetchDocument,
  getIssue,
  getProject,
  listFavorites,
  listIssues,
  listStates,
  listTeams,
  test,
  type TestUser,
} from './fixtures'

type Api = Parameters<typeof createWorkspace>[0]

async function seedWorkspace(api: Api, user: TestUser) {
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const states = Object.fromEntries(
    (await listStates(api, user, team.id)).map(state => [state.name, state])
  )
  return { workspace, team, states }
}

test.describe('project page', () => {
  test('the Issues tab is the shared issue list and changes refresh the progress', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const project = await createProject(api, user, {
      workspace_id: workspace.id,
      name: 'Checkout',
      team_ids: [team.id],
    })
    const issue = await createIssue(api, user, {
      team_id: team.id,
      title: 'Pay with card',
      project_id: project.id,
    })
    await createIssue(api, user, { team_id: team.id, title: 'Other work' })

    await page.goto(`/${workspace.url_key}/project/${project.id}?tab=issues`)
    const list = page.getByRole('listbox', { name: 'Issues' })
    const row = list.getByRole('option', { name: /Pay with card/ })
    await expect(row).toBeVisible()
    await expect(list.getByRole('option', { name: /Other work/ })).toHaveCount(0)

    // Display options stay in the URL next to the tab.
    await page.getByRole('button', { name: 'Display' }).click()
    await page.getByRole('button', { name: 'Board' }).click()
    await expect(page).toHaveURL(/tab=issues/)
    await expect(page).toHaveURL(/layout=board/)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('region', { name: 'Issue board' })).toBeVisible()
    await page.goto(`/${workspace.url_key}/project/${project.id}?tab=issues`)

    // Inline status change on the row: the project progress follows at once.
    await row.getByRole('button', { name: 'Status: Todo' }).click()
    await page.getByRole('option', { name: 'Done' }).click()
    await expect.poll(async () => (await getIssue(api, user, issue.id)).state.name).toBe('Done')
    await page.getByRole('tab', { name: 'Overview' }).click()
    await expect(page.getByRole('region', { name: 'Progress' })).toContainText(
      '1 of 1 issues completed'
    )
  })

  test('the Documents tab lists and creates project documents; the star adds a favorite', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace } = await seedWorkspace(api, user)
    const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Atlas' })
    await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Atlas spec',
      project_id: project.id,
    })
    await createDocument(api, user, { workspace_id: workspace.id, title: 'Loose notes' })

    await page.goto(`/${workspace.url_key}/project/${project.id}`)
    await page.getByRole('button', { name: 'Add to favorites' }).click()
    await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible()
    await expect(page.getByTestId('sidebar-favorite').filter({ hasText: 'Atlas' })).toBeVisible()
    expect((await listFavorites(api, user, workspace.id)).map(f => f.entity_id)).toEqual([
      project.id,
    ])

    await page.getByRole('tab', { name: 'Documents' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/project/${project.id}?tab=documents`)
    const documents = page.getByRole('list', { name: 'Documents' })
    await expect(documents.getByRole('link', { name: /Atlas spec/ })).toBeVisible()
    await expect(page.getByText('Loose notes')).toHaveCount(0)

    await page.getByRole('main').getByRole('button', { name: 'New document' }).click()
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/document/[0-9a-f-]{36}$`))
    const documentId = page.url().split('/').pop()!
    const created = await (await fetchDocument(api, user, documentId)).json()
    expect(created.project_id).toBe(project.id)
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Atlas' })
    ).toBeVisible()
  })

  test('an empty project shows empty Issues and Documents tabs', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace } = await seedWorkspace(api, user)
    const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Void' })
    await page.goto(`/${workspace.url_key}/project/${project.id}?tab=issues`)
    await expect(page.getByText('No issues in this project')).toBeVisible()
    await page.getByRole('tab', { name: 'Documents' }).click()
    await expect(page.getByText('No documents in this project')).toBeVisible()
  })
})

test('a document moves to a project and can be a favorite', async ({
  api,
  user,
  authedPage: page,
}) => {
  const { workspace } = await seedWorkspace(api, user)
  const project = await createProject(api, user, { workspace_id: workspace.id, name: 'Orbit' })
  const document = await createDocument(api, user, {
    workspace_id: workspace.id,
    title: 'Launch notes',
  })

  await page.goto(`/${workspace.url_key}/document/${document.id}`)
  await expect(page.getByRole('textbox', { name: 'Document title' })).toHaveValue('Launch notes')
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  await page.getByRole('option', { name: 'Orbit' }).click()
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(breadcrumb.getByRole('link', { name: 'Orbit' })).toBeVisible()
  await expect
    .poll(async () => (await (await fetchDocument(api, user, document.id)).json()).project_id)
    .toBe(project.id)

  // The menu item opens the same picker; "No project" takes it out again.
  await page.getByRole('button', { name: 'Document actions' }).click()
  await page.getByRole('menuitem', { name: 'Move to project…' }).click()
  await page.getByRole('option', { name: 'No project' }).click()
  await expect(breadcrumb.getByRole('link', { name: 'Orbit' })).toHaveCount(0)
  await expect
    .poll(async () => (await (await fetchDocument(api, user, document.id)).json()).project_id)
    .toBeNull()

  await page.getByRole('button', { name: 'Add to favorites' }).click()
  await expect(
    page.getByTestId('sidebar-favorite').filter({ hasText: 'Launch notes' })
  ).toBeVisible()
  expect((await listFavorites(api, user, workspace.id)).map(f => f.entity_type)).toEqual([
    'document',
  ])
  // The project's progress is untouched by documents.
  expect((await getProject(api, user, project.id))?.progress.total).toBe(0)
})

test('a sub-issue is created from the full create modal', async ({
  api,
  user,
  authedPage: page,
}) => {
  const { workspace, team } = await seedWorkspace(api, user)
  const parent = await createIssue(api, user, { team_id: team.id, title: 'Release 2.0' })
  await page.goto(`/${workspace.url_key}/issue/${parent.identifier}`)
  await expect(page.getByRole('textbox', { name: 'Issue title' })).toHaveValue('Release 2.0')

  await page.getByRole('button', { name: 'Add sub-issues' }).click()
  await page.getByRole('button', { name: 'Create sub-issue with all properties' }).click()
  const dialog = page.getByRole('dialog', { name: 'New issue' })
  await expect(
    dialog.getByRole('button', { name: `Parent issue: ${parent.identifier}` })
  ).toBeVisible()
  await dialog.getByLabel('Issue title').fill('Write changelog')
  await dialog.getByLabel('Issue title').press('ControlOrMeta+Enter')
  await expect(dialog).toBeHidden()

  const section = page.getByRole('region', { name: 'Sub-issues' })
  await expect(section.getByRole('link', { name: /Write changelog/ })).toBeVisible()
  const { items } = await listIssues(api, user, workspace.id)
  expect(items.filter(i => i.parent_id === parent.id).map(i => i.title)).toEqual([
    'Write changelog',
  ])
})

test('archives issues from the list context menu', async ({ api, user, authedPage: page }) => {
  const { workspace, team } = await seedWorkspace(api, user)
  const issue = await createIssue(api, user, { team_id: team.id, title: 'Old idea' })
  await createIssue(api, user, { team_id: team.id, title: 'Keep me' })

  await page.goto(`/${workspace.url_key}/team/${team.key}/issues`)
  const list = page.getByRole('listbox', { name: 'Issues' })
  await list.getByRole('option', { name: /Old idea/ }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Archive issue' }).click()
  await expect(page.getByText(`Archived ${issue.identifier}`)).toBeVisible()
  await expect(list.getByRole('option', { name: /Old idea/ })).toHaveCount(0)
  await expect(list.getByRole('option', { name: /Keep me/ })).toBeVisible()
  // The list hides the row before the PATCH ends: wait for the backend.
  await expect.poll(async () => (await getIssue(api, user, issue.id)).archived_at).not.toBeNull()
})

test('the shortcuts help lists the issue page and inbox keys', async ({
  api,
  user,
  authedPage: page,
}) => {
  const { workspace } = await seedWorkspace(api, user)
  await page.goto(`/${workspace.url_key}/my-issues`)
  await expect(page.getByRole('heading', { level: 1, name: 'My issues' })).toBeVisible()
  await page.keyboard.press('?')
  const help = page.getByRole('dialog', { name: /Keyboard shortcuts/ })
  await expect(help).toContainText('Issue page')
  await expect(help).toContainText('Assign to me')
  await expect(help).toContainText('Inbox')
})
