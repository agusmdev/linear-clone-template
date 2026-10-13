/**
 * Onboarding, the home redirect and the workspace settings area (WS-1..WS-7,
 * AUTH-3): workspace, members, labels, teams, team settings (members and
 * workflow), account.
 */
import { randomUUID } from 'node:crypto'
import {
  type Page,
  createIssue,
  createLabel,
  createTeam,
  createWorkspace,
  expect,
  getIssue,
  getMe,
  getTeam,
  inviteMember,
  listLabels,
  listMembers,
  listStates,
  listTeamMembers,
  listTeams,
  listWorkspaces,
  registerUser,
  removeTeamMember,
  test,
  updateLabel,
  updateMemberRole,
  updateWorkflowState,
} from './fixtures'

/** Lowercase letters only: safe in a name, a URL key and a team key. */
function suffix(): string {
  return randomUUID()
    .replace(/[^a-f]/g, '')
    .slice(0, 6)
    .padEnd(6, 'a')
}

function settingsNav(page: Page) {
  return page.getByRole('navigation', { name: 'Settings' })
}

test.describe('onboarding and home', () => {
  test('a new user creates a workspace; the URL follows the name', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const name = `Rocket ${suffix()}`
    const urlKey = name.toLowerCase().replace(' ', '-')
    await page.goto('/')
    await expect(page).toHaveURL('/onboarding')
    await expect(page.getByRole('heading', { name: 'Create a new workspace' })).toBeVisible()

    await page.getByLabel('Workspace name').fill(name)
    await expect(page.getByLabel('Workspace URL')).toHaveValue(urlKey)
    await page.getByRole('button', { name: 'Create workspace' }).click()

    await expect(page).toHaveURL(`/${urlKey}/my-issues`)
    const [workspace] = await listWorkspaces(api, user)
    expect(workspace).toMatchObject({ name, url_key: urlKey })
    // The backend made the first team with its workflow.
    const teams = await listTeams(api, user, workspace.id)
    expect(teams.map(t => t.key)).toEqual(['ENG'])
  })

  test('onboarding validates the URL and reports a taken one', async ({
    authedPage: page,
    api,
  }) => {
    const owner = await registerUser(api)
    const taken = await createWorkspace(api, owner)
    await page.goto('/onboarding')

    await page.getByLabel('Workspace name').fill('Taken')
    await page.getByLabel('Workspace URL').fill('-bad-')
    await page.getByRole('button', { name: 'Create workspace' }).click()
    await expect(page.getByText('Use lowercase letters, numbers and dashes only')).toBeVisible()

    await page.getByLabel('Workspace URL').fill(taken.url_key)
    await page.getByRole('button', { name: 'Create workspace' }).click()
    await expect(page.getByText('This URL is already taken')).toBeVisible()
    await expect(page).toHaveURL('/onboarding')
  })

  test('"/" and the workspace root open My issues of the first workspace', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user, { name: 'Home Co' })

    await page.goto('/')
    await expect(page).toHaveURL(`/${workspace.url_key}/my-issues`)

    await page.goto(`/${workspace.url_key}`)
    await expect(page).toHaveURL(`/${workspace.url_key}/my-issues`)
    await page.goto(`/${workspace.url_key}/`)
    await expect(page).toHaveURL(`/${workspace.url_key}/my-issues`)
  })

  test('the workspace menu opens settings and onboarding', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user, { name: 'Menu Co' })
    await page.goto(`/${workspace.url_key}/settings/account`)

    await page.getByRole('link', { name: 'Back to app' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/my-issues`)

    await page.getByRole('button', { name: 'Workspace: Menu Co' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/settings`)
    await expect(settingsNav(page)).toBeVisible()

    // Esc leaves the settings.
    await page.goto(`/${workspace.url_key}/settings/members`)
    await expect(settingsNav(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(`/${workspace.url_key}/my-issues`)

    await page.getByRole('button', { name: 'Workspace: Menu Co' }).click()
    await page.getByRole('menuitem', { name: 'Create or join workspace' }).click()
    await expect(page).toHaveURL('/onboarding')
    // The existing workspace is offered there too.
    await expect(page.getByRole('link', { name: /Menu Co/ })).toBeVisible()
  })

  test('a long workspace name truncates before the sidebar actions', async ({
    authedPage: page,
    api,
    user,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const name = `QA Auth Workspace With A Long Name ${suffix()}`
    const workspace = await createWorkspace(api, user, { name })
    await page.goto(`/${workspace.url_key}/my-issues`)

    const trigger = page.getByRole('button', { name: `Workspace: ${name}` })
    const search = page.getByRole('button', { name: 'Search', exact: true })
    await expect(trigger).toBeVisible()
    await expect(search).toBeVisible()
    const triggerBox = await trigger.boundingBox()
    const searchBox = await search.boundingBox()
    const chevronBox = await trigger.locator('svg').last().boundingBox()
    if (!triggerBox || !searchBox || !chevronBox) throw new Error('No layout boxes')
    // The trigger and its chevron end before the Search button starts.
    expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(searchBox.x)
    expect(chevronBox.x + chevronBox.width).toBeLessThanOrEqual(triggerBox.x + triggerBox.width)
    expect(chevronBox.width).toBeGreaterThan(0)
    // The name is cut with an ellipsis.
    const nameText = trigger.getByText(name)
    expect(await nameText.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  })
})

test.describe('workspace settings', () => {
  test('an admin renames the workspace and changes its URL', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user, { name: 'Old Name' })
    const newKey = `renamed-${suffix()}`
    // The general page is the settings index (the trailing slash opens it too).
    await page.goto(`/${workspace.url_key}/settings/`)

    await page.getByLabel('Workspace name').fill('New Name')
    await page.getByLabel('Workspace URL').fill(newKey)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(`/${newKey}/settings`)
    await expect(page.getByLabel('Workspace name')).toHaveValue('New Name')
    const [updated] = await listWorkspaces(api, user)
    expect(updated).toMatchObject({ name: 'New Name', url_key: newKey })
  })

  test('an admin deletes the workspace after typing its name', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user, { name: 'Doomed' })
    await page.goto(`/${workspace.url_key}/settings`)

    await page.getByRole('button', { name: 'Delete workspace' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('button', { name: 'Delete workspace' })).toBeDisabled()
    await dialog.getByLabel('Workspace name to confirm').fill('Doomed')
    await dialog.getByRole('button', { name: 'Delete workspace' }).click()

    await expect(page).toHaveURL('/onboarding')
    expect(await listWorkspaces(api, user)).toEqual([])
  })

  test('a member sees the settings read-only and can leave', async ({ loginAs, api, user }) => {
    const member = await registerUser(api)
    const workspace = await createWorkspace(api, user, { name: 'Shared' })
    await inviteMember(api, user, workspace.id, member.email)
    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/settings`)

    await expect(page.getByLabel('Workspace name')).toBeDisabled()
    await expect(page.getByText('Only admins can change the workspace settings.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete workspace' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Leave workspace' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave workspace' }).click()

    await expect(page).toHaveURL('/onboarding')
    expect(await listWorkspaces(api, member)).toEqual([])
  })
})

test.describe('members', () => {
  test('an admin invites an existing user, changes the role and removes them', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    const invited = await registerUser(api)
    await page.goto(`/${workspace.url_key}/settings/members`)

    // Unknown email: a clear error, nobody is added.
    await page.getByPlaceholder('email@example.com').fill(`nobody-${suffix()}@example.com`)
    await page.getByRole('button', { name: 'Invite' }).click()
    await expect(
      page.getByText('No account uses this email. Ask them to sign up first.')
    ).toBeVisible()

    await page.getByPlaceholder('email@example.com').fill(invited.email)
    await page.getByRole('button', { name: 'Invite' }).click()
    const row = page.getByRole('listitem', { name: invited.email })
    await expect(row).toBeVisible()
    await expect(row.getByRole('combobox', { name: `Role of ${invited.email}` })).toHaveText(
      'Member'
    )

    await row.getByRole('combobox', { name: `Role of ${invited.email}` }).click()
    await page.getByRole('option', { name: 'Admin' }).click()
    await expect
      .poll(async () => (await listMembers(api, user, workspace.id)).map(m => m.role))
      .toEqual(['admin', 'admin'])

    await row.getByRole('button', { name: `Actions for ${invited.email}` }).click()
    await page.getByRole('menuitem', { name: 'Remove from workspace' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove member' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(row).toHaveCount(0)
    await expect.poll(async () => (await listMembers(api, user, workspace.id)).length).toBe(1)
  })

  test('the last admin cannot step down', async ({ authedPage: page, api, user }) => {
    const workspace = await createWorkspace(api, user)
    const me = await getMe(api, user)
    await page.goto(`/${workspace.url_key}/settings/members`)

    const name = me.display_name || me.email
    await page.getByRole('combobox', { name: `Role of ${name}` }).click()
    await page.getByRole('option', { name: 'Member' }).click()

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText(
      'Could not change the role'
    )
    const [member] = await listMembers(api, user, workspace.id)
    expect(member.role).toBe('admin')
  })

  test('members see the list without admin controls', async ({ loginAs, api, user }) => {
    const member = await registerUser(api)
    const workspace = await createWorkspace(api, user)
    const added = await inviteMember(api, user, workspace.id, member.email)
    await updateMemberRole(api, user, workspace.id, added.id, 'member')
    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/settings/members`)

    await expect(page.getByRole('listitem', { name: member.email })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Invite' })).toHaveCount(0)
    await expect(page.getByRole('combobox')).toHaveCount(0)
    await page.getByLabel('Search members').fill('zzz-nobody')
    await expect(page.getByText('No members found')).toBeVisible()
  })
})

test.describe('labels', () => {
  test('creates, renames, recolors and deletes a label', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/settings/labels`)
    await expect(page.getByRole('listitem', { name: 'Bug' })).toBeVisible()

    await page.getByRole('button', { name: 'New label' }).click()
    await page.getByLabel('Label name').fill('Design')
    await page.getByRole('button', { name: /^Label color/ }).click()
    await page.getByRole('option', { name: '#26b5ce' }).click()
    await page.getByRole('button', { name: 'Create label' }).click()
    await expect(page.getByRole('listitem', { name: 'Design' })).toBeVisible()
    let labels = await listLabels(api, user, workspace.id)
    expect(labels.find(l => l.name === 'Design')?.color).toBe('#26b5ce')

    // A duplicate name (any case) is refused.
    await page.getByRole('button', { name: 'New label' }).click()
    await page.getByLabel('Label name').fill('design')
    await page.getByRole('button', { name: 'Create label' }).click()
    await expect(page.getByText('A label with this name already exists')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    const row = page.getByRole('listitem', { name: 'Design' })
    await row.getByRole('button', { name: 'Actions for Design' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await page.getByLabel('Label name').fill('UX')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('listitem', { name: 'UX' })).toBeVisible()

    await page.getByRole('button', { name: 'Color of UX: #26b5ce' }).click()
    await page.getByRole('option', { name: '#f2994a' }).click()
    await expect(page.getByRole('button', { name: 'Color of UX: #f2994a' })).toBeVisible()
    labels = await listLabels(api, user, workspace.id)
    expect(labels.find(l => l.name === 'UX')?.color).toBe('#f2994a')

    await page
      .getByRole('listitem', { name: 'UX' })
      .getByRole('button', { name: 'Actions for UX' })
      .click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete label' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('listitem', { name: 'UX' })).toHaveCount(0)
    expect((await listLabels(api, user, workspace.id)).map(l => l.name)).toEqual([
      'Bug',
      'Feature',
      'Improvement',
    ])
  })

  test('shows labels changed through the API and filters them', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    const label = await createLabel(api, user, workspace.id, { name: 'Backend', color: '#4cb782' })
    await updateLabel(api, user, label.id, { name: 'Server' })
    await page.goto(`/${workspace.url_key}/settings/labels`)

    await expect(page.getByRole('listitem', { name: 'Server' })).toBeVisible()
    await page.getByLabel('Search labels').fill('serv')
    await expect(page.getByRole('list', { name: 'Labels' }).getByRole('listitem')).toHaveCount(1)
  })
})

test.describe('teams', () => {
  test('creates a team, then leaves and joins it from the list', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    const name = `Design ${suffix()}`
    await page.goto(`/${workspace.url_key}/settings/teams`)

    await page.getByRole('button', { name: 'Create team' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Team name').fill(name)
    await expect(dialog.getByLabel('Team key')).toHaveValue('DES')
    await dialog.getByRole('button', { name: 'Create team' }).click()

    await expect(page).toHaveURL(`/${workspace.url_key}/settings/team/DES`)
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
    const team = (await listTeams(api, user, workspace.id)).find(t => t.key === 'DES')
    expect(team).toBeDefined()
    expect(await listStates(api, user, team!.id)).toHaveLength(6)
    // The sidebar of the app lists the new team too.
    await expect(settingsNav(page).getByRole('link', { name })).toBeVisible()

    await page.goto(`/${workspace.url_key}/settings/teams`)
    const row = page.getByRole('listitem', { name })
    await expect(row.getByText('1 member')).toBeVisible()
    await row.getByRole('button', { name: `Leave ${name}` }).click()
    await expect(row.getByRole('button', { name: `Join ${name}` })).toBeVisible()
    expect(await listTeamMembers(api, user, team!.id)).toEqual([])
    await row.getByRole('button', { name: `Join ${name}` }).click()
    await expect(row.getByText('Joined')).toBeVisible()
  })

  test('a taken team key is reported in the dialog', async ({ authedPage: page, api, user }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/settings/teams`)

    await page.getByRole('button', { name: 'Create team' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Team name').fill('Engine room')
    await dialog.getByRole('button', { name: 'Create team' }).click()

    await expect(dialog.getByText('Another team already uses this key')).toBeVisible()
  })
})

test.describe('team settings', () => {
  test('renames the team and changes its key; identifiers follow', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Keyed' })
    await page.goto(`/${workspace.url_key}/settings/team/${team.key}`)

    await page.getByLabel('Team name').fill('Platform')
    await page.getByLabel('Team key').fill('plt')
    await page.getByLabel('Description').fill('Core services')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL(`/${workspace.url_key}/settings/team/PLT`)
    expect(await getTeam(api, user, team.id)).toMatchObject({
      name: 'Platform',
      key: 'PLT',
      description: 'Core services',
    })
    expect((await getIssue(api, user, issue.id)).identifier).toBe(`PLT-${issue.number}`)
  })

  test('adds and removes team members', async ({ authedPage: page, api, user }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const colleague = await registerUser(api)
    await inviteMember(api, user, workspace.id, colleague.email)
    await page.goto(`/${workspace.url_key}/settings/team/${team.key}`)

    await page.getByRole('button', { name: 'Add member' }).click()
    await page.getByRole('option', { name: colleague.email }).click()
    const members = page.getByRole('list', { name: 'Team members' })
    await expect(members.getByRole('listitem', { name: colleague.email })).toBeVisible()
    await expect.poll(async () => (await listTeamMembers(api, user, team.id)).length).toBe(2)

    await page.getByRole('button', { name: `Remove ${colleague.email} from the team` }).click()
    await expect(members.getByRole('listitem', { name: colleague.email })).toHaveCount(0)

    // Leave, then join again.
    await page.getByRole('button', { name: 'Leave team' }).click()
    await expect(page.getByRole('button', { name: 'Join team' })).toBeVisible()
    await page.getByRole('button', { name: 'Join team' }).click()
    await expect(page.getByRole('button', { name: 'Leave team' })).toBeVisible()
  })

  test('a workspace member outside the team sees it read-only until joining', async ({
    loginAs,
    api,
    user,
  }) => {
    const member = await registerUser(api)
    const workspace = await createWorkspace(api, user)
    await inviteMember(api, user, workspace.id, member.email)
    const team = await createTeam(api, user, workspace.id, { name: 'Ops', key: 'OPS' })
    const page = await loginAs(member)
    await page.goto(`/${workspace.url_key}/settings/team/OPS`)

    await expect(page.getByText('Join the team to change its settings.')).toBeVisible()
    await expect(page.getByLabel('Team name')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Add status to Started' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Join team' }).click()
    await expect(page.getByLabel('Team name')).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Add status to Started' })).toBeVisible()
    await removeTeamMember(api, member, team.id, 'me')
  })

  test('manages the workflow: add, rename, recolor, reorder, delete', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    await page.goto(`/${workspace.url_key}/settings/team/${team.key}`)
    const started = page.getByRole('list', { name: 'Started statuses', exact: true })
    await expect(started.getByRole('listitem')).toHaveCount(2)

    // Add "QA" at the end of Started.
    await page.getByRole('button', { name: 'Add status to Started' }).click()
    await page.getByLabel('Status name').fill('QA')
    await page.getByRole('button', { name: 'Add status', exact: true }).click()
    await expect(started.getByRole('listitem')).toHaveText(['In Progress', 'In Review', 'QA'])

    // Rename it.
    await started.getByRole('button', { name: 'Actions for QA' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await page.getByLabel('Status name').fill('Testing')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(started.getByRole('listitem', { name: 'Testing' })).toBeVisible()

    // Recolor it.
    await started.getByRole('button', { name: /^Color of Testing/ }).click()
    await page.getByRole('option', { name: '#4cb782' }).click()
    await expect(started.getByRole('button', { name: 'Color of Testing: #4cb782' })).toBeVisible()

    // Move it up twice: first in Started.
    const testing = started.getByRole('listitem', { name: 'Testing' })
    await testing.hover()
    await testing.getByRole('button', { name: 'Move Testing up' }).click()
    await expect(started.getByRole('listitem')).toHaveText(['In Progress', 'Testing', 'In Review'])
    await testing.hover()
    await testing.getByRole('button', { name: 'Move Testing up' }).click()
    await expect(started.getByRole('listitem')).toHaveText(['Testing', 'In Progress', 'In Review'])

    const states = await listStates(api, user, team.id)
    const created = states.find(s => s.name === 'Testing')!
    expect(created).toMatchObject({ type: 'started', color: '#4cb782' })
    const startedOrder = states.filter(s => s.type === 'started').map(s => s.name)
    expect(startedOrder).toEqual(['Testing', 'In Progress', 'In Review'])

    // Delete it; its issue moves to the status picked in the dialog.
    const issue = await createIssue(api, user, {
      team_id: team.id,
      title: 'Under test',
      state_id: created.id,
    })
    await page.reload()
    await started.getByRole('button', { name: 'Actions for Testing' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('combobox', { name: 'Move issues to' }).click()
    await page.getByRole('option', { name: 'Done' }).click()
    await dialog.getByRole('button', { name: 'Delete status' }).click()
    await expect(dialog).toHaveCount(0)

    await expect(started.getByRole('listitem', { name: 'Testing' })).toHaveCount(0)
    expect((await getIssue(api, user, issue.id)).state.name).toBe('Done')
  })

  test('shows workflow changes made through the API', async ({ authedPage: page, api, user }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const todo = (await listStates(api, user, team.id)).find(s => s.name === 'Todo')!
    await updateWorkflowState(api, user, todo.id, { name: 'Ready' })
    await page.goto(`/${workspace.url_key}/settings/team/${team.key}`)

    await expect(
      page.getByRole('list', { name: 'Unstarted statuses', exact: true }).getByRole('listitem', {
        name: 'Ready',
      })
    ).toBeVisible()
  })

  test('an admin deletes a team; an unknown key shows not found', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    await createTeam(api, user, workspace.id, { name: 'Temp', key: 'TMP' })
    await page.goto(`/${workspace.url_key}/settings/team/TMP`)

    await page.getByRole('button', { name: 'Delete team' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete team' }).click()

    await expect(page).toHaveURL(`/${workspace.url_key}/settings/teams`)
    expect((await listTeams(api, user, workspace.id)).map(t => t.key)).toEqual(['ENG'])

    await page.goto(`/${workspace.url_key}/settings/team/NOPE`)
    await expect(page.getByText('Team not found')).toBeVisible()
  })
})

test.describe('account', () => {
  test('changes the display name and the theme, and logs out', async ({
    authedPage: page,
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/settings/account`)
    await expect(page.getByLabel('Email')).toHaveValue(user.email)

    await page.getByLabel('Full name').fill('Grace Hopper')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Profile updated')).toBeVisible()
    expect((await getMe(api, user)).display_name).toBe('Grace Hopper')

    await page.getByRole('combobox', { name: 'Interface theme' }).click()
    await page.getByRole('option', { name: 'Light' }).click()
    await expect(page.locator('html')).toHaveClass(/light/)

    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/login')
  })
})
