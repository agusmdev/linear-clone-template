/**
 * Documents (DOC-1..DOC-5, DOC-7): the workspace documents list with search,
 * "New document", and the full-page editor (title, icon, rich text with slash
 * commands, autosave, issue links, copy link, delete).
 */
import {
  createDocument,
  createIssue,
  createWorkspace,
  expect,
  fetchDocument,
  listDocuments,
  listTeams,
  test,
} from './fixtures'

test.describe('documents list', () => {
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
