/**
 * Documents (DOC-1..DOC-5, DOC-7): the workspace documents list with search,
 * "New document", and the full-page editor (title, icon, rich text with slash
 * commands, autosave, issue links, copy link, delete).
 */
import {
  authHeaders,
  createDocument,
  createIssue,
  createProject,
  createWorkspace,
  expect,
  fetchDocument,
  listDocuments,
  inviteMember,
  listTeams,
  registerUser,
  test,
} from './fixtures'

test.describe('documents list', () => {
  test('shows the author, not the last editor (DOC-1)', async ({ api, user, authedPage: page }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Shared doc' })
    const editor = await registerUser(api)
    await inviteMember(api, user, workspace.id, editor.email)
    const response = await api.patch(`/documents/${doc.id}`, {
      data: { content: '<p>Edited by someone else</p>' },
      headers: authHeaders(editor),
    })
    expect(response.ok()).toBe(true)

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/${workspace.url_key}/documents`)
    const row = page
      .getByRole('list', { name: 'Documents' })
      .getByRole('link', { name: /Shared doc/ })
    await expect(row.getByTitle('Author')).toHaveText(doc.creator!.name || doc.creator!.email)
    await expect(row.locator('time')).toHaveAttribute('title', /^Edited by /)
    await expect(row).not.toContainText(editor.email)
  })

  test('lists the workspace documents, newest edit first, and searches title and content', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Onboarding guide',
      icon: '📘',
    })
    await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Release plan',
      content: '<p>The secret needle is here</p>',
    })

    await page.goto(`/${workspace.url_key}/documents`)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Documents')
    const rows = page.getByRole('list', { name: 'Documents' }).getByRole('link')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText('Release plan')
    await expect(rows.nth(1)).toContainText('Onboarding guide')
    await expect(rows.nth(1)).toContainText('📘')
    await expect(rows.first()).toContainText('just now')

    const search = page.getByLabel('Search documents')
    await search.fill('needle')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Release plan')

    await search.fill('nothing matches this')
    await expect(page.getByText('No documents found')).toBeVisible()

    await search.fill('')
    await expect(rows).toHaveCount(2)
    await rows.nth(1).click()
    await expect(page).toHaveURL(/\/document\/[0-9a-f-]+$/)
    await expect(page.getByLabel('Document title')).toHaveValue('Onboarding guide')
  })

  test('search matches the visible text, not the HTML markup or LIKE wildcards', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Rich doc',
      content: '<p><strong>Tom</strong> &amp; <a href="https://x.dev">Jerry</a></p>',
    })
    await createDocument(api, user, { workspace_id: workspace.id, title: 'Plain doc' })

    await page.goto(`/${workspace.url_key}/documents`)
    const rows = page.getByRole('list', { name: 'Documents' }).getByRole('link')
    await expect(rows).toHaveCount(2)

    const search = page.getByLabel('Search documents')
    for (const term of ['strong', 'href', '%', '_']) {
      await search.fill(term)
      await expect(page.getByText('No documents found')).toBeVisible()
    }

    await search.fill('Tom & Jerry')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Rich doc')
  })

  test('lists every document, past the first page of 100', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    // The oldest edit is listed last, so it is only on the second page.
    for (let i = 0; i < 101; i++) {
      await createDocument(api, user, { workspace_id: workspace.id, title: `Doc ${i}` })
    }

    await page.goto(`/${workspace.url_key}/documents`)

    const rows = page.getByRole('list', { name: 'Documents' }).getByRole('link')
    await expect(rows).toHaveCount(101)
    await expect(rows.last()).toContainText('Doc 0')
  })

  test('"New document" creates an Untitled document and opens it', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/documents`)
    await expect(page.getByText('No documents', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'New document' }).first().click()

    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/document/[0-9a-f-]+$`))
    await expect(page.getByLabel('Document title')).toHaveValue('Untitled')
    const { items } = await listDocuments(api, user, workspace.id)
    expect(items.map(d => d.title)).toEqual(['Untitled'])
    expect(page.url()).toContain(items[0].id)
  })

  test('a team has its own Documents page that lists and creates team documents (DOC-2)', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    await createDocument(api, user, {
      workspace_id: workspace.id,
      team_id: team.id,
      title: 'Team runbook',
    })
    await createDocument(api, user, { workspace_id: workspace.id, title: 'Company handbook' })

    // The sidebar shows a Documents link under the team.
    await page.goto(`/${workspace.url_key}/team/${team.key}/issues`)
    await page
      .getByRole('navigation', { name: 'Main' })
      .locator(`a[href="/${workspace.url_key}/team/${team.key}/documents"]`)
      .click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/${team.key}/documents`)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Documents')
    const rows = page.getByRole('list', { name: 'Documents' }).getByRole('link')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Team runbook')

    await page.getByRole('button', { name: 'New document' }).first().click()

    await expect(page).toHaveURL(new RegExp(`/${workspace.url_key}/document/[0-9a-f-]+$`))
    await expect(page.getByLabel('Document title')).toHaveValue('Untitled')
    const { items } = await listDocuments(api, user, workspace.id)
    const created = items.find(d => d.title === 'Untitled')
    expect(created?.team_id).toBe(team.id)
    expect(page.url()).toContain(created?.id)
  })

  test('a team Documents page for an unknown team key says so', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/team/NOPE/documents`)
    await expect(page.getByText('Team not found')).toBeVisible()
  })
})

test.describe('document editor', () => {
  test('autosaves the title and rich text, and shows who edited it last', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Untitled' })

    await page.goto(`/${workspace.url_key}/document/${doc.id}`)
    await expect(page.getByTestId('document-last-edited')).toContainText('Last edited by')

    const title = page.getByLabel('Document title')
    await title.fill('Q4 roadmap')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Q4 roadmap')
    await title.press('Enter')

    const editor = page.getByLabel('Document content')
    await expect(editor).toBeFocused()
    await page.keyboard.type('/head')
    await expect(page.getByRole('listbox', { name: 'Insert block' })).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.type('Goals')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Ship the **editor** now')

    await expect(page.getByRole('status')).toHaveText('Saved')
    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).content)
      .toBe('<h1>Goals</h1><p>Ship the <strong>editor</strong> now</p>')
    const saved = await (await fetchDocument(api, user, doc.id)).json()
    expect(saved.title).toBe('Q4 roadmap')
    expect(saved.last_edited_by.email).toBe(user.email)

    // The content survives a reload.
    await page.reload()
    await expect(page.getByLabel('Document title')).toHaveValue('Q4 roadmap')
    await expect(editor.locator('h1')).toHaveText('Goals')
    await expect(editor.locator('strong')).toHaveText('editor')
  })

  test('saves edits typed just before a reload (keepalive flush on pagehide)', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Draft',
      content: '<p>Start</p>',
    })

    await page.goto(`/${workspace.url_key}/document/${doc.id}`)
    const editor = page.getByLabel('Document content')
    await expect(editor).toContainText('Start')

    await page.getByLabel('Document title').fill('Draft fast')
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' QUICKRELOAD')
    // Reload inside the 800 ms debounce: no React unmount runs.
    await page.reload()

    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).content)
      .toBe('<p>Start QUICKRELOAD</p>')
    expect((await (await fetchDocument(api, user, doc.id)).json()).title).toBe('Draft fast')

    await page.reload()
    await expect(page.getByLabel('Document title')).toHaveValue('Draft fast')
    await expect(editor).toHaveText('Start QUICKRELOAD')
  })

  test('saves edits typed just before the tab closes', async ({ api, user, loginAs }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Draft',
      content: '<p>Start</p>',
    })
    const page = await loginAs(user)

    await page.goto(`/${workspace.url_key}/document/${doc.id}`)
    const editor = page.getByLabel('Document content')
    await expect(editor).toContainText('Start')
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' QUICKCLOSE')
    // Close inside the 800 ms debounce, as a user closing the tab.
    await page.close({ runBeforeUnload: true })

    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).content)
      .toBe('<p>Start QUICKCLOSE</p>')
  })

  test('shows "Unsaved" as soon as a saved document changes, until the change is saved', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Notes' })

    await page.goto(`/${workspace.url_key}/document/${doc.id}`)
    const status = page.getByRole('status')
    // A document that was just opened has nothing to report.
    await expect(status).toBeHidden()

    const editor = page.getByLabel('Document content')
    await editor.click()
    await page.keyboard.type('First draft')
    await expect(status).toHaveText('Unsaved')
    await expect(status).toHaveText('Saved')
    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).content)
      .toBe('<p>First draft</p>')

    // After a save, a new edit must not keep showing "Saved" during the debounce.
    await page.keyboard.type(' and more')
    await expect(status).toHaveText('Unsaved')
    await expect(status).toHaveText('Saved')
    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).content)
      .toBe('<p>First draft and more</p>')

    // The title uses the same indicator.
    await page.getByLabel('Document title').fill('Meeting notes')
    await expect(status).toHaveText('Unsaved')
    await expect(status).toHaveText('Saved')
    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).title)
      .toBe('Meeting notes')
  })

  test('issue identifiers in the text link to the issue (DOC-7)', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Linked issue' })
    const doc = await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'Spec',
      content: `<p>Blocked by ${issue.identifier} for now</p>`,
    })

    await page.goto(`/${workspace.url_key}/document/${doc.id}`)

    const link = page.getByLabel('Document content').getByRole('link', { name: issue.identifier })
    await expect(link).toHaveAttribute('href', `/${workspace.url_key}/issue/${issue.identifier}`)
  })

  test('picks and removes an emoji icon', async ({ api, user, authedPage: page }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Icons' })
    await page.goto(`/${workspace.url_key}/document/${doc.id}`)

    await page.getByRole('button', { name: 'Add icon' }).click()
    await page.getByRole('option', { name: 'Icon 🚀' }).click()

    await expect(page.getByRole('button', { name: 'Change icon' })).toContainText('🚀')
    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).icon)
      .toBe('🚀')

    await page.getByRole('button', { name: 'Change icon' }).click()
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByRole('button', { name: 'Add icon' })).toBeVisible()
    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).icon)
      .toBeNull()
  })

  test('copies the link of the document', async ({ api, user, authedPage: page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Share me' })
    await page.goto(`/${workspace.url_key}/document/${doc.id}`)

    await page.getByRole('button', { name: 'Document actions' }).click()
    await page.getByRole('menuitem', { name: 'Copy link' }).click()

    await expect(page.getByText('Link copied to clipboard')).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain(`/${workspace.url_key}/document/${doc.id}`)
  })

  test('deletes the document after a confirmation and goes back to the list', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Old notes' })
    await page.goto(`/${workspace.url_key}/document/${doc.id}`)

    await page.getByRole('button', { name: 'Document actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete document' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Old notes')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(`/${workspace.url_key}/documents`)
    await expect(page.getByText('No documents', { exact: true })).toBeVisible()
    expect((await fetchDocument(api, user, doc.id)).status()).toBe(404)
  })

  test('the sidebar favorite follows a rename, an icon change and a delete at once', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Draft' })
    const doomed = await createDocument(api, user, {
      workspace_id: workspace.id,
      title: 'To delete',
    })
    await page.goto(`/${workspace.url_key}/document/${doc.id}`)

    const favorites = page.getByRole('navigation', { name: 'Main' }).getByTestId('sidebar-favorite')
    await page.getByRole('button', { name: 'Add to favorites' }).click()
    await expect(favorites).toHaveCount(1)
    await expect(favorites.first()).toHaveText('Draft')

    // Rename: the favorite shows the new title without a reload.
    const title = page.getByLabel('Document title')
    await title.fill('Final plan')
    await title.blur()
    await expect(page.getByRole('status')).toHaveText('Saved')
    await expect(favorites.first()).toHaveText('Final plan')

    // Icon: the favorite shows the document's emoji, not the generic page icon.
    await page.getByRole('button', { name: 'Add icon' }).click()
    await page.getByRole('option', { name: 'Icon 🚀' }).click()
    await expect(favorites.first()).toContainText('🚀')

    // Delete: the favorite of the deleted document goes away without a reload.
    await page.goto(`/${workspace.url_key}/document/${doomed.id}`)
    await page.getByRole('button', { name: 'Add to favorites' }).click()
    await expect(favorites).toHaveCount(2)
    await expect(favorites.nth(1)).toHaveText('To delete')
    await page.getByRole('button', { name: 'Document actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete document' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/documents`)
    await expect(favorites).toHaveCount(1)
    await expect(favorites.first()).toContainText('Final plan')
  })

  test('a long title wraps, and a pasted line break becomes a space', async ({
    api,
    user,
    authedPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const workspace = await createWorkspace(api, user)
    const longTitle = 'A rather long document title that cannot fit on one phone line'
    const doc = await createDocument(api, user, { workspace_id: workspace.id, title: longTitle })
    await page.goto(`/${workspace.url_key}/document/${doc.id}`)

    const title = page.getByLabel('Document title')
    await expect(title).toHaveValue(longTitle)
    // Every word is on screen: the title grows to more lines instead of scrolling.
    const box = await title.boundingBox()
    if (!box) throw new Error('title is not laid out')
    expect(box.height).toBeGreaterThan(60)
    expect(await title.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

    await title.fill('')
    await title.pressSequentially('Line one')
    await page.keyboard.insertText('\nline two')
    await expect(title).toHaveValue('Line one line two')
    await title.press('Enter')
    await expect(page.getByLabel('Document content')).toBeFocused()
    await expect
      .poll(async () => (await (await fetchDocument(api, user, doc.id)).json()).title)
      .toBe('Line one line two')
  })

  test('a document of another workspace is not opened under this one', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    const other = await createWorkspace(api, user, { name: 'Other' })
    const doc = await createDocument(api, user, { workspace_id: other.id, title: 'Elsewhere' })

    await page.goto(`/${workspace.url_key}/document/${doc.id}`)
    await expect(page.getByText('Document not found')).toBeVisible()
    await expect(page.getByLabel('Document title')).toHaveCount(0)

    await page.goto(`/${other.url_key}/document/${doc.id}`)
    await expect(page.getByLabel('Document title')).toHaveValue('Elsewhere')
  })

  test('shows "Document not found" for a missing document', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const workspace = await createWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/document/00000000-0000-4000-8000-000000000000`)

    await expect(page.getByText('Document not found')).toBeVisible()
    await page.getByRole('link', { name: 'Back to documents' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/documents`)
  })
})

test.describe('document header on a phone', () => {
  test('the breadcrumbs truncate and never run under the project chip at 390px', async ({
    api,
    user,
    authedPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const workspace = await createWorkspace(api, user)
    const project = await createProject(api, user, {
      workspace_id: workspace.id,
      name: 'Doc Project Beta',
    })
    const doc = await createDocument(api, user, {
      workspace_id: workspace.id,
      project_id: project.id,
      title: 'My Spec Doc',
      icon: '🚀',
    })
    await page.goto(`/${workspace.url_key}/document/${doc.id}`)

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb.getByRole('link', { name: 'Doc Project Beta' })).toBeAttached()
    const chip = page.getByRole('button', { name: 'Project', exact: true })
    await expect(chip).toBeVisible()
    // On a phone the chip is icon-only: the breadcrumb already names the project.
    await expect(chip.getByText('Doc Project Beta')).toBeHidden()

    const navBox = await breadcrumb.boundingBox()
    const chipBox = await chip.boundingBox()
    if (!navBox || !chipBox) throw new Error('header is not laid out')
    const navRight = navBox.x + navBox.width
    expect(navRight).toBeLessThanOrEqual(chipBox.x)
    // Every crumb and the title end inside the nav, so no text runs under the chip.
    for (const part of await breadcrumb.locator('a, h1').all()) {
      const box = await part.boundingBox()
      if (!box) throw new Error('breadcrumb part is not laid out')
      expect(box.x + box.width).toBeLessThanOrEqual(navRight + 0.5)
    }
  })
})
