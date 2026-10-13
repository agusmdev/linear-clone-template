/**
 * CYC-1: team cycles. The list page (Current / Upcoming / Past, progress, scope),
 * the "New cycle" dialog, and the cycle page (summary, issues, edit, delete,
 * move unfinished issues). Data is seeded through the real API.
 */
import {
  type Page,
  completeCycle,
  createCycle,
  createIssue,
  createWorkspace,
  errorToast,
  expect,
  getCycleResponse,
  getIssue,
  isoDay,
  listCycles,
  listStates,
  listTeams,
  test,
  type TestUser,
} from './fixtures'
import type { Team, WorkflowState } from '../src/types/team'
import type { Workspace } from '../src/types/workspace'

type APIRequestContext = Parameters<typeof createWorkspace>[0]

interface Seed {
  workspace: Workspace
  team: Team
  states: Record<string, WorkflowState>
}

async function seedWorkspace(api: APIRequestContext, user: TestUser): Promise<Seed> {
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const states = Object.fromEntries(
    (await listStates(api, user, team.id)).map(state => [state.name, state])
  )
  return { workspace, team, states }
}

function cycleRow(page: Page, label: string) {
  return page.getByTestId('cycle-row').filter({ hasText: label })
}

test.describe('cycles API', () => {
  test('creates, lists, reads and completes cycles', async ({ api, user }) => {
    const { team, states } = await seedWorkspace(api, user)
    const current = await createCycle(api, user, team.id, {
      starts_at: isoDay(-3),
      ends_at: isoDay(10),
    })
    const next = await createCycle(api, user, team.id, {
      starts_at: isoDay(11),
      ends_at: isoDay(24),
      name: 'Next',
    })
    expect([current.number, next.number]).toEqual([1, 2])
    expect((await listCycles(api, user, team.id)).map(c => c.status)).toEqual([
      'current',
      'upcoming',
    ])

    const open = await createIssue(api, user, {
      team_id: team.id,
      title: 'Open',
      cycle_id: current.id,
    })
    await createIssue(api, user, {
      team_id: team.id,
      title: 'Done',
      state_id: states['Done'].id,
      cycle_id: current.id,
    })
    const response = await getCycleResponse(api, user, current.id)
    expect(response.ok()).toBe(true)
    expect((await response.json()).progress).toMatchObject({ total: 2, percentage: 50 })

    const result = await completeCycle(api, user, current.id)
    expect(result).toMatchObject({ moved: 1, target_cycle: { id: next.id } })
    expect((await getIssue(api, user, open.id)).cycle_id).toBe(next.id)
  })
})

test.describe('cycles page', () => {
  test('a team without cycles shows the empty state and creates the first cycle', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)

    await page.goto(`/${workspace.url_key}/team/${team.key}/cycles`)
    await expect(page.getByRole('heading', { level: 1, name: 'Cycles' })).toBeVisible()
    await expect(page.getByText('No cycles', { exact: true })).toBeVisible()
    await expect(page.getByText('Cycles help your team work in focused periods.')).toBeVisible()

    await page.getByRole('button', { name: 'Create cycle' }).click()
    const dialog = page.getByRole('dialog', { name: 'New cycle' })
    await expect(dialog.getByLabel('Name (optional)')).toHaveAttribute('placeholder', 'Cycle 1')
    // Default: two weeks from today.
    await expect(dialog.getByLabel('Start date')).not.toHaveValue('')
    await expect(dialog.getByTestId('cycle-length')).toHaveText('14 days · 2 weeks')
    await dialog.getByLabel('Name (optional)').fill('Kickoff')
    await dialog.getByLabel('Start date').fill(isoDay(-1))
    await dialog.getByLabel('End date').fill(isoDay(12))
    await dialog.getByRole('button', { name: 'Create cycle' }).click()

    await expect(dialog).toBeHidden()
    const current = page.getByRole('region', { name: 'Current' })
    await expect(current.getByTestId('cycle-row')).toHaveCount(1)
    await expect(cycleRow(page, 'Cycle 1')).toContainText('Kickoff')
    await expect(cycleRow(page, 'Cycle 1')).toContainText('0 issues')

    const [saved] = await listCycles(api, user, team.id)
    expect(saved).toMatchObject({
      number: 1,
      name: 'Kickoff',
      starts_at: isoDay(-1),
      ends_at: isoDay(12),
      status: 'current',
    })
  })

  test('the new cycle dialog starts after the last cycle and checks the dates', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    await createCycle(api, user, team.id, { starts_at: isoDay(0), ends_at: isoDay(13) })

    await page.goto(`/${workspace.url_key}/team/${team.key}/cycles`)
    await page.getByRole('button', { name: 'New cycle' }).click()
    const dialog = page.getByRole('dialog', { name: 'New cycle' })
    await expect(dialog.getByLabel('Name (optional)')).toHaveAttribute('placeholder', 'Cycle 2')
    await expect(dialog.getByLabel('Start date')).toHaveValue(isoDay(14))
    await expect(dialog.getByLabel('End date')).toHaveValue(isoDay(27))

    // The end must be after the start (client-side check).
    await dialog.getByLabel('End date').fill(isoDay(14))
    await dialog.getByRole('button', { name: 'Create cycle' }).click()
    await expect(dialog.getByText('The end date must be after the start date')).toBeVisible()

    // An overlap is refused by the backend.
    await dialog.getByLabel('Start date').fill(isoDay(5))
    await dialog.getByLabel('End date').fill(isoDay(20))
    await dialog.getByRole('button', { name: 'Create cycle' }).click()
    await expect(errorToast(page)).toContainText('Could not create cycle')
    await expect(errorToast(page)).toContainText('overlap Cycle 1')
    await expect(dialog).toBeVisible()
    expect(await listCycles(api, user, team.id)).toHaveLength(1)
  })

  test('shows current, upcoming and past cycles with progress and scope', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team, states } = await seedWorkspace(api, user)
    await createCycle(api, user, team.id, { starts_at: isoDay(-30), ends_at: isoDay(-17) })
    await createCycle(api, user, team.id, { starts_at: isoDay(-16), ends_at: isoDay(-3) })
    const current = await createCycle(api, user, team.id, {
      starts_at: isoDay(-2),
      ends_at: isoDay(11),
      name: 'Launch',
    })
    await createCycle(api, user, team.id, { starts_at: isoDay(12), ends_at: isoDay(25) })
    for (const [title, state] of [
      ['One', 'Todo'],
      ['Two', 'In Progress'],
      ['Three', 'Done'],
      ['Four', 'Done'],
    ]) {
      await createIssue(api, user, {
        team_id: team.id,
        title,
        state_id: states[state].id,
        cycle_id: current.id,
      })
    }

    await page.goto(`/${workspace.url_key}/team/${team.key}/cycles`)

    const sections = page.locator('section h2')
    await expect(sections).toHaveText(['Current1', 'Upcoming1', 'Past2'])
    const past = page.getByRole('region', { name: 'Past' }).getByTestId('cycle-row')
    // Most recent past cycle first.
    await expect(past.first()).toContainText('Cycle 2')
    await expect(past.last()).toContainText('Cycle 1')
    await expect(page.getByRole('region', { name: 'Upcoming' })).toContainText('Cycle 4')

    const row = cycleRow(page, 'Cycle 3')
    await expect(row).toContainText('Launch')
    await expect(row).toContainText('4 issues')
    await expect(row).toContainText('50%')
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    await expect(
      row.getByTestId('cycle-scope').getByRole('img', { name: 'Completed' })
    ).toBeVisible()

    await row.getByRole('link', { name: 'Cycle 3' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/${team.key}/cycle/${current.id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Launch' })).toBeVisible()
  })

  test('edits and deletes a cycle from its row menu', async ({ api, user, authedPage: page }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const cycle = await createCycle(api, user, team.id, {
      starts_at: isoDay(1),
      ends_at: isoDay(14),
    })

    await page.goto(`/${workspace.url_key}/team/${team.key}/cycles`)
    await page.getByRole('button', { name: 'Cycle 1 actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit cycle' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit cycle' })
    await expect(dialog.getByLabel('Start date')).toHaveValue(isoDay(1))
    await dialog.getByLabel('Name (optional)').fill('Polish')
    await dialog.getByLabel('End date').fill(isoDay(7))
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(cycleRow(page, 'Cycle 1')).toContainText('Polish')
    expect((await listCycles(api, user, team.id))[0]).toMatchObject({
      id: cycle.id,
      name: 'Polish',
      ends_at: isoDay(7),
    })

    await page.getByRole('button', { name: 'Cycle 1 actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete cycle' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Delete Polish?' })
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No cycles', { exact: true })).toBeVisible()
    expect(await listCycles(api, user, team.id)).toEqual([])
  })

  test('an unknown team key shows a message', async ({ api, user, authedPage: page }) => {
    const { workspace } = await seedWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/team/NOPE/cycles`)
    await expect(page.getByText('Team not found')).toBeVisible()
  })
})

test.describe('cycle page', () => {
  test('shows the dates, progress, scope and issues of the cycle', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team, states } = await seedWorkspace(api, user)
    const cycle = await createCycle(api, user, team.id, {
      starts_at: isoDay(-2),
      ends_at: isoDay(11),
    })
    await createIssue(api, user, { team_id: team.id, title: 'Write the spec', cycle_id: cycle.id })
    await createIssue(api, user, {
      team_id: team.id,
      title: 'Ship it',
      state_id: states['Done'].id,
      cycle_id: cycle.id,
    })
    await createIssue(api, user, { team_id: team.id, title: 'Not in the cycle' })

    await page.goto(`/${workspace.url_key}/team/${team.key}/cycle/${cycle.id}`)

    await expect(page.getByRole('heading', { level: 1, name: 'Cycle 1' })).toBeVisible()
    const summary = page.getByRole('region', { name: 'Cycle summary' })
    await expect(summary).toContainText('Current')
    await expect(summary).toContainText('11 days left')
    await expect(summary.getByTestId('cycle-completed')).toHaveText('1 of 2 completed')
    await expect(summary.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')

    // The issues are the shared IssuesView, scoped to the cycle and grouped by status.
    const issues = page.getByRole('listbox', { name: 'Issues' }).getByRole('option')
    await expect(issues).toHaveCount(2)
    await expect(page.getByRole('group', { name: 'Todo', exact: true })).toContainText(
      'Write the spec'
    )
    await expect(page.getByRole('group', { name: 'Done', exact: true })).toContainText('Ship it')
    await expect(page.getByText('Not in the cycle')).toHaveCount(0)

    // "New issue" opens the create-issue modal with the cycle preselected.
    await page.evaluate(() => {
      window.addEventListener('linear:create-issue', event => {
        document.body.dataset.createIssue = JSON.stringify((event as CustomEvent).detail)
      })
    })
    await page.getByRole('main').getByRole('button', { name: 'New issue' }).first().click()
    await expect(page.locator('body')).toHaveAttribute(
      'data-create-issue',
      JSON.stringify({ teamId: team.id, cycleId: cycle.id })
    )
    const dialog = page.getByRole('dialog', { name: 'New issue' })
    await expect(dialog.getByRole('button', { name: /^Cycle: / })).not.toHaveAccessibleName(
      'Cycle: none'
    )
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Cycles' })
      .click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/${team.key}/cycles`)
  })

  test('edits the cycle, moves unfinished issues and deletes it', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const cycle = await createCycle(api, user, team.id, {
      starts_at: isoDay(-13),
      ends_at: isoDay(0),
    })
    const next = await createCycle(api, user, team.id, {
      starts_at: isoDay(1),
      ends_at: isoDay(14),
    })
    const issue = await createIssue(api, user, {
      team_id: team.id,
      title: 'Carry over',
      cycle_id: cycle.id,
    })

    await page.goto(`/${workspace.url_key}/team/${team.key}/cycle/${cycle.id}`)
    await expect(
      page.getByRole('listbox', { name: 'Issues' }).getByRole('option', { name: /Carry over/ })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Cycle actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit cycle' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit cycle' })
    await dialog.getByLabel('Name (optional)').fill('Sprint A')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sprint A' })).toBeVisible()

    await page.getByRole('button', { name: 'Cycle actions' }).click()
    await page.getByRole('menuitem', { name: 'Move unfinished issues' }).click()
    await expect(page.getByText('Moved 1 issue to Cycle 2')).toBeVisible()
    await expect(page.getByText('No issues in this cycle')).toBeVisible()
    expect((await getIssue(api, user, issue.id)).cycle_id).toBe(next.id)

    await page.getByRole('button', { name: 'Cycle actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete cycle' }).click()
    await page
      .getByRole('alertdialog', { name: 'Delete Sprint A?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/${team.key}/cycles`)
    await expect(cycleRow(page, 'Cycle 2')).toBeVisible()
    expect((await getCycleResponse(api, user, cycle.id)).status()).toBe(404)
    expect((await getIssue(api, user, issue.id)).cycle_id).toBe(next.id)
  })

  test('a missing cycle shows a message', async ({ api, user, authedPage: page }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    await page.goto(
      `/${workspace.url_key}/team/${team.key}/cycle/00000000-0000-0000-0000-000000000000`
    )
    await expect(page.getByText('This cycle does not exist or was deleted.')).toBeVisible()
    await page.getByRole('link', { name: 'Back to cycles' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/${team.key}/cycles`)
  })
})

test('an unknown workspace shows a message', async ({ authedPage: page }) => {
  await page.goto(`/no-such-workspace-${Date.now()}`)
  await expect(page.getByText('Workspace not found')).toBeVisible()
})
