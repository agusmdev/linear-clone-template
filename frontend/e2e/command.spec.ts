/**
 * Slice "command": the Cmd/Ctrl+K command palette, global keyboard shortcuts,
 * the search page, the views page and sidebar favorites (UX-1, UX-2, UX-4, UX-5).
 */
import {
  addFavorite,
  createDocument,
  createIssue,
  createTeam,
  createWorkspace,
  deleteFavorite,
  expect,
  listFavorites,
  listTeams,
  searchWorkspace,
  test,
  updateFavorite,
  type Page,
} from './fixtures'

/** Records every 'linear:create-issue' event the app dispatches. */
async function recordCreateIssueEvents(page: Page) {
  await page.evaluate(() => {
    const events: unknown[] = []
    ;(window as unknown as { __createIssueEvents: unknown[] }).__createIssueEvents = events
    window.addEventListener('linear:create-issue', event =>
      events.push((event as CustomEvent).detail)
    )
  })
  return () =>
    page.evaluate(
      () => (window as unknown as { __createIssueEvents: unknown[] }).__createIssueEvents.length
    )
}

function palette(page: Page) {
  return page.getByRole('dialog', { name: 'Command menu' })
}

test.describe('command palette', () => {
  test('opens with Cmd/Ctrl+K and the event, navigates and runs actions', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    const createEvents = await recordCreateIssueEvents(page)

    await page.keyboard.press('ControlOrMeta+k')
    await expect(palette(page)).toBeVisible()
    for (const label of [
      'Create new issue',
      'Create new document',
      'Create new project',
      'Go to inbox',
      'Go to my issues',
      'Go to Engineering issues',
      'Go to settings',
      'Log out',
    ]) {
      await expect(palette(page).getByRole('option', { name: label })).toBeVisible()
    }

    // Create new issue dispatches the cross-slice event and closes the palette.
    await palette(page).getByRole('combobox').fill('create new issue')
    await page.keyboard.press('Enter')
    await expect(palette(page)).toBeHidden()
    expect(await createEvents()).toBe(1)
    // The event opens the create-issue modal (slice "issues-list"): close it.
    await expect(page.getByRole('dialog', { name: 'New issue' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'New issue' })).toBeHidden()

    // The window event opens the palette too.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('linear:command-palette')))
    await expect(palette(page)).toBeVisible()
    await palette(page).getByRole('combobox').fill('search workspace')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/${workspace.url_key}/search`)

    // Toggle theme.
    await page.getByRole('heading', { level: 1, name: 'Search' }).click()
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('light theme')
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveClass(/light/)
    // Cmd+K toggles: wait until the action has closed the palette.
    await expect(palette(page)).toBeHidden()

    // Team navigation.
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('engineering issues')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/${workspace.url_key}/team/ENG/issues`)
  })

  test('searches issues as you type and Enter opens the result', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const issue = await createIssue(api, user, {
      team_id: team.id,
      title: 'Quantum flux capacitor',
    })
    await createIssue(api, user, { team_id: team.id, title: 'Unrelated work' })

    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('quantum')
    const result = palette(page).getByRole('option', {
      name: `${issue.identifier} Quantum flux capacitor`,
    })
    await expect(result).toBeVisible()
    await expect(palette(page).getByRole('option', { name: /Unrelated work/ })).toHaveCount(0)
    await result.click()
    await expect(page).toHaveURL(`/${workspace.url_key}/issue/${issue.identifier}`)
  })

  test('the first async result is selected, Enter opens it and no empty message shows', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Zebra crossing bug' })

    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    // 'zebra' matches no static command: only the async issue result shows.
    await palette(page).getByRole('combobox').fill('zebra')
    const result = palette(page).getByRole('option', {
      name: `${issue.identifier} Zebra crossing bug`,
    })
    await expect(result).toBeVisible()
    await expect(result).toHaveAttribute('aria-selected', 'true')
    await expect(palette(page).getByText('No results.')).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/${workspace.url_key}/issue/${issue.identifier}`)
    await expect(palette(page)).toBeHidden()

    // A query with no static and no async match still shows the empty message.
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('qwxzv')
    await expect(palette(page).getByText('No results.')).toBeVisible()
    await expect(palette(page).getByRole('option')).toHaveCount(0)
  })

  test('async results above a command that matched first take the highlight', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Login page broken' })

    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    // "login" fuzzy-matches "Log out" before the issue search answers; the issue
    // shows above it and Enter must open the issue, not sign the user out.
    await palette(page).getByRole('combobox').fill('login')
    const result = palette(page).getByRole('option', {
      name: `${issue.identifier} Login page broken`,
    })
    await expect(result).toHaveAttribute('aria-selected', 'true')
    await expect(palette(page).getByRole('option', { name: 'Log out' })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/${workspace.url_key}/issue/${issue.identifier}`)
  })

  test('results of an earlier query are never selected for the new text', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Zebra crossing bug' })

    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('zebra')
    await expect(
      palette(page).getByRole('option', { name: `${issue.identifier} Zebra crossing bug` })
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette(page)).toBeHidden()

    // Reopen and type a command, then Enter at once (before the search debounce):
    // the "zebra" results must not be shown, selected and opened.
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('create new document')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/document/[0-9a-f-]{36}$`))
  })

  test('create new document makes a document and opens it', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('create new document')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/document/[0-9a-f-]{36}$`))
    const [doc] = (await searchWorkspace(api, user, workspace.id, 'Untitled')).documents
    expect(page.url()).toContain(doc.id)
  })

  test('create new issue while the issue modal is open keeps what is typed', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('c')
    const modal = page.getByRole('dialog', { name: 'New issue' })
    await modal.getByLabel('Issue title').fill('Half-written issue')
    await modal.getByLabel('Issue description').click()
    await page.keyboard.type('Steps to reproduce')

    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('create new issue')
    await page.keyboard.press('Enter')
    await expect(palette(page)).toBeHidden()

    await expect(modal.getByLabel('Issue title')).toHaveValue('Half-written issue')
    await expect(modal.getByLabel('Issue description')).toHaveText('Steps to reproduce')
  })

  test('create new project opens the project dialog; search finds the project', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('create new project')
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'New project' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Project name').fill('Moonshot')
    await dialog.getByRole('button', { name: 'Create project' }).click()
    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/project/[0-9a-f-]{36}$`))
    const [project] = (await searchWorkspace(api, user, workspace.id, 'moonshot')).projects
    expect(page.url()).toContain(project.id)

    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('moon')
    await expect(palette(page).getByRole('option', { name: 'Moonshot' })).toBeVisible()
  })

  test('log out from the palette signs the user out', async ({ api, user, authedPage: page }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await palette(page).getByRole('combobox').fill('log out')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('global shortcuts', () => {
  test('C, /, ? and G-sequences work outside inputs', async ({ api, user, authedPage: page }) => {
    const workspace = await createWorkspace(api, user)
    const base = `/${workspace.url_key}`
    const openViews = async () => {
      await page.goto(`${base}/views`)
      await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()
    }

    await openViews()
    const createEvents = await recordCreateIssueEvents(page)
    await page.keyboard.press('c')
    expect(await createEvents()).toBe(1)
    // The event opens the create-issue modal (slice "issues-list"): close it.
    await expect(page.getByRole('dialog', { name: 'New issue' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'New issue' })).toBeHidden()

    await page.keyboard.press('?')
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(help).toBeVisible()
    for (const text of ['Open command menu', 'Go to inbox', 'Go to my issues', 'Move down']) {
      await expect(help.getByText(text)).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await expect(help).toBeHidden()

    // "/" opens the search page with the input focused; typing does not fire shortcuts.
    await page.keyboard.press('/')
    await expect(page).toHaveURL(`${base}/search`)
    const input = page.getByRole('searchbox', { name: 'Search workspace' })
    await expect(input).toBeFocused()
    await page.keyboard.type('gi c')
    await expect(input).toHaveValue('gi c')
    await expect(page).toHaveURL(new RegExp(`${base}/search`))

    const sequences: [string, string][] = [
      ['i', 'inbox'],
      ['m', 'my-issues'],
      ['p', 'projects'],
      ['d', 'documents'],
      ['s', 'settings'],
    ]
    for (const [key, target] of sequences) {
      await openViews()
      await page.keyboard.press('g')
      await page.keyboard.press(key)
      await expect(page).toHaveURL(`${base}/${target}`)
    }
  })
  test('page shortcuts do not fire inside an open dialog', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const base = `/${workspace.url_key}`
    await page.goto(`${base}/views`)
    await expect(page.getByRole('heading', { level: 1, name: 'Views' })).toBeVisible()

    await page.keyboard.press('c')
    const modal = page.getByRole('dialog', { name: 'New issue' })
    await expect(modal).toBeVisible()
    await modal.getByRole('textbox', { name: 'Issue title' }).fill('Draft in progress')
    // After a pick, focus is back on the chip (not a text field) but still in the modal.
    await modal.getByRole('button', { name: /^Priority:/ }).click()
    await page.getByRole('option', { name: 'High' }).click()
    const priority = modal.getByRole('button', { name: 'Priority: High' })
    await expect(priority).toBeFocused()

    // C must not reset the form, G S must not navigate under it, ? must not open help.
    await page.keyboard.press('c')
    await page.keyboard.press('g')
    await page.keyboard.press('s')
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden()
    await expect(page).toHaveURL(`${base}/views`)
    await expect(modal.getByRole('textbox', { name: 'Issue title' })).toHaveValue(
      'Draft in progress'
    )
    await expect(priority).toBeVisible()

    // Closed (the typed title is discarded), the shortcuts work again.
    await page.keyboard.press('Escape')
    const prompt = page.getByRole('alertdialog', { name: 'Save issue as draft?' })
    await prompt.getByRole('button', { name: 'Discard' }).click()
    await expect(modal).toBeHidden()
    await expect(prompt).toBeHidden()
    await page.keyboard.press('g')
    await page.keyboard.press('s')
    await expect(page).toHaveURL(`${base}/settings`)
  })
})

test.describe('search page', () => {
  test('shows grouped results with tabs, keyboard navigation and favorites', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const rocket = await createIssue(api, user, { team_id: team.id, title: 'Rocket launch' })
    await createIssue(api, user, {
      team_id: team.id,
      title: 'Fuel check',
      description: '<p>before the rocket goes</p>',
    })
    await createIssue(api, user, { team_id: team.id, title: 'Other' })
    const doc = await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Rocket design doc',
    })
    const apiResults = await searchWorkspace(api, user, workspace.id, 'rocket')
    expect(apiResults.issues).toHaveLength(2)
    expect(apiResults.documents.map(d => d.id)).toEqual([doc.id])

    await page.goto(`/${workspace.url_key}/search?q=rocket`)
    await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible()
    const input = page.getByRole('searchbox', { name: 'Search workspace' })
    await expect(input).toHaveValue('rocket')
    const results = page.getByTestId('search-result')
    await expect(results).toHaveCount(3)
    const region = page.getByRole('region', { name: 'Search results' })
    await expect(region.getByRole('heading', { name: /Issues/ })).toBeVisible()
    await expect(region.getByRole('heading', { name: /Documents/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /All\s*3/ })).toBeVisible()

    // Tabs filter the type; projects have none.
    await page.getByRole('tab', { name: /Documents/ }).click()
    await expect(page).toHaveURL(/type=documents/)
    await expect(results).toHaveCount(1)
    await expect(results.first()).toContainText('Rocket design doc')
    await page.getByRole('tab', { name: /Projects/ }).click()
    await expect(page.getByText('No results')).toBeVisible()
    await page.getByRole('tab', { name: /Issues/ }).click()
    await expect(results).toHaveCount(2)

    // Every word matches, in any order, and each one is highlighted.
    await input.fill('launch rocket')
    await expect(results).toHaveCount(1)
    await expect(results.first().locator('mark')).toHaveText(['Rocket', 'launch'])

    // A new query updates the results and the URL.
    await input.fill('launch')
    await expect(results).toHaveCount(1)
    await expect(page).toHaveURL(/q=launch/)

    // Favorite from the result row: it shows in the sidebar.
    await results.first().getByRole('button', { name: 'Add to favorites' }).click()
    const favorites = page.getByRole('navigation', { name: 'Main' }).getByTestId('sidebar-favorite')
    await expect(favorites).toHaveCount(1)
    await expect(favorites.first()).toContainText(`${rocket.identifier} Rocket launch`)
    await expect(
      results.first().getByRole('button', { name: 'Remove from favorites' })
    ).toBeVisible()
    expect((await listFavorites(api, user, workspace.id)).map(f => f.entity_id)).toEqual([
      rocket.id,
    ])
    await results.first().getByRole('button', { name: 'Remove from favorites' }).click()
    await expect(favorites).toHaveCount(0)
    expect(await listFavorites(api, user, workspace.id)).toEqual([])

    // Enter opens the highlighted result.
    await input.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/${workspace.url_key}/issue/${rocket.identifier}`)
  })

  test('a pasted query longer than the API accepts searches its first characters', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    await createIssue(api, user, { team_id: team.id, title: 'Rocket launch' })
    // 260 characters: the API takes at most 200 (longer used to fail with a 422).
    const long = `Rocket launch${' '.repeat(240)}tail end`
    const tooLong: string[] = []
    page.on('response', response => {
      if (response.url().includes('/search?') && response.status() === 422) {
        tooLong.push(response.url())
      }
    })

    await page.goto(`/${workspace.url_key}/search`)
    await page.getByRole('searchbox', { name: 'Search workspace' }).fill(long)
    await expect(page.getByTestId('search-result')).toHaveCount(1)
    await expect(page.getByText('Search failed')).toHaveCount(0)

    await page.keyboard.press('ControlOrMeta+k')
    await expect(palette(page)).toBeVisible()
    await page.keyboard.insertText(long)
    await expect(palette(page).getByRole('option', { name: /Rocket launch/ })).toBeVisible()
    expect(tooLong).toEqual([])
  })

  test('a long issue identifier stays on one line', async ({ api, user, authedPage: page }) => {
    const workspace = await createWorkspace(api, user)
    // A five-letter key with two digits is wider than the old fixed identifier column.
    const team = await createTeam(api, user, workspace.id, { name: 'Marketing', key: 'MWMWM' })
    for (let n = 1; n < 10; n++) {
      await createIssue(api, user, { team_id: team.id, title: `Filler ${n}` })
    }
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Gizmo launch' })

    await page.goto(`/${workspace.url_key}/search?q=gizmo`)
    const identifier = page
      .getByTestId('search-result')
      .getByText(issue.identifier, { exact: true })
    await expect(identifier).toBeVisible()
    expect(await identifier.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(24)
  })

  test('an empty query shows the search prompt', async ({ api, user, authedPage: page }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/search`)
    await expect(page.getByText('Search your workspace')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search workspace' }).fill('zzz-nothing')
    await expect(page.getByText('No results')).toBeVisible()
  })
})

test.describe('views page', () => {
  test('lists the built-in views as cards that link to their pages', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    // The workspace root renders the shell; the sidebar's Views link opens the page.
    await page.goto(`/${workspace.url_key}`)
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Views' })
      .click()
    await expect(page).toHaveURL(`/${workspace.url_key}/views`)
    const main = page.getByRole('main')
    for (const name of [
      'My issues',
      'Projects',
      'Documents',
      'Engineering · All issues',
      'Engineering · Active',
      'Engineering · Backlog',
    ]) {
      await expect(main.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible()
    }
    await main.getByRole('link', { name: /^Engineering · Active/ }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/ENG/issues?tab=active`)
    await expect(page.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('sidebar favorites', () => {
  test('lists my favorites, links to them and reorders by drag and drop', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Starred issue' })
    const issueFavorite = await addFavorite(api, user, {
      workspace_id: workspace.id,
      entity_type: 'issue',
      entity_id: issue.id,
    })
    const teamFavorite = await addFavorite(api, user, {
      workspace_id: workspace.id,
      entity_type: 'team',
      entity_id: team.id,
    })
    expect(teamFavorite.identifier).toBe('ENG')

    await page.goto(`/${workspace.url_key}/views`)
    const sidebar = page.getByRole('navigation', { name: 'Main' })
    const rows = sidebar.getByTestId('sidebar-favorite')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText(`${issue.identifier} Starred issue`)
    await expect(rows.nth(1)).toContainText('Engineering')

    // Drag the team above the issue.
    await rows.nth(1).dragTo(rows.nth(0))
    await expect(rows.nth(0)).toContainText('Engineering')
    await expect
      .poll(async () => (await listFavorites(api, user, workspace.id)).map(f => f.id))
      .toEqual([teamFavorite.id, issueFavorite.id])

    await rows.nth(0).getByRole('link').click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/ENG/issues`)
  })

  test('favorites API: reorder and remove', async ({ api, user }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const favorite = await addFavorite(api, user, {
      workspace_id: workspace.id,
      entity_type: 'team',
      entity_id: team.id,
    })
    const moved = await updateFavorite(api, user, favorite.id, { sort_order: 7 })
    expect(moved.sort_order).toBe(7)
    await deleteFavorite(api, user, favorite.id)
    expect(await listFavorites(api, user, workspace.id)).toEqual([])
  })
})
