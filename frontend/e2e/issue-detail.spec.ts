/**
 * The issue page /$workspaceKey/issue/$identifier: title, description,
 * properties, sub-issues, relations, comments, activity, subscription,
 * archive and delete. Everything is checked against the real backend.
 */
import {
  addWorkspaceMember,
  createComment,
  createCycle,
  createProject,
  createIssue,
  createRelation,
  createWorkspace,
  deleteRelation,
  expect,
  getIssue,
  getMe,
  isoDay,
  listActivity,
  listComments,
  listFavorites,
  listLabels,
  listNotifications,
  listRelations,
  listStates,
  listSubIssues,
  listSubscribers,
  listTeams,
  registerUser,
  subscribe,
  test,
  unsubscribe,
  updateComment,
  updateIssue,
  type Page,
  type TestUser,
} from './fixtures'

type Api = Parameters<typeof listTeams>[0]

async function seedWorkspace(api: Api, user: TestUser) {
  const workspace = await createWorkspace(api, user, { name: 'Acme' })
  const [team] = await listTeams(api, user, workspace.id)
  const states = await listStates(api, user, team.id)
  const state = (name: string) => {
    const found = states.find(s => s.name === name)
    if (!found) throw new Error(`No state ${name}`)
    return found
  }
  return { workspace, team, state }
}

function issueUrl(urlKey: string, identifier: string) {
  return `/${urlKey}/issue/${identifier}`
}

async function openIssue(page: Page, urlKey: string, identifier: string) {
  await page.goto(`/${urlKey}/issue/${identifier}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(identifier)
}

test.describe('issue page', () => {
  test('shows the issue with its breadcrumb and edits title and description', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const issue = await createIssue(api, user, {
      team_id: team.id,
      title: 'Fix the login bug',
      description: '<p>Steps to reproduce</p>',
    })

    // The identifier in the URL is case-insensitive.
    await page.goto(`/${workspace.url_key}/issue/${issue.identifier.toLowerCase()}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ENG-1')
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb.getByRole('link', { name: team.name })).toHaveAttribute(
      'href',
      `/${workspace.url_key}/team/ENG/issues`
    )

    const title = page.getByRole('textbox', { name: 'Issue title' })
    await expect(title).toHaveValue('Fix the login bug')
    await title.fill('Fix the sign-in bug')
    await title.press('Enter')
    await expect
      .poll(async () => (await getIssue(api, user, issue.id)).title)
      .toBe('Fix the sign-in bug')

    // Escape restores the saved title; an empty title is not saved.
    await title.fill('Not this one')
    await title.press('Escape')
    await expect(title).toHaveValue('Fix the sign-in bug')
    await title.fill('   ')
    await title.blur()
    await expect(title).toHaveValue('Fix the sign-in bug')

    const description = page.getByRole('textbox', { name: 'Issue description' })
    await expect(description).toContainText('Steps to reproduce')
    await description.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' on Safari')
    await expect
      .poll(async () => (await getIssue(api, user, issue.id)).description, { timeout: 10_000 })
      .toContain('Steps to reproduce on Safari')

    // The changes are in the activity timeline.
    const activity = page.getByRole('list', { name: 'Activity' })
    await expect(activity.getByText(/created the issue/)).toBeVisible()
    await expect(activity.getByText(/changed the title from/)).toContainText('Fix the sign-in bug')
    await expect(activity.getByText(/updated the description/)).toBeVisible()
  })

  test('changes every property from the side panel', async ({ api, user, authedPage: page }) => {
    const { workspace, team, state } = await seedWorkspace(api, user)
    const me = await getMe(api, user)
    const labels = await listLabels(api, user, workspace.id)
    const bug = labels.find(l => l.name === 'Bug')
    if (!bug) throw new Error('No Bug label')
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Panel' })
    const cycle = await createCycle(api, user, team.id, {
      name: 'Sprint 1',
      starts_at: isoDay(-1),
      ends_at: isoDay(6),
    })
    const project = await createProject(api, user, {
      workspace_id: workspace.id,
      name: 'Billing revamp',
      team_ids: [team.id],
    })
    await openIssue(page, workspace.url_key, issue.identifier)
    const panel = page.getByRole('complementary', { name: 'Issue properties' })

    await panel.getByRole('button', { name: 'Change status' }).click()
    await page.getByRole('option', { name: 'In Progress' }).click()
    await expect(panel.getByRole('button', { name: 'Change status' })).toContainText('In Progress')

    await panel.getByRole('button', { name: 'Change priority' }).click()
    await page.getByRole('option', { name: 'High' }).click()
    await expect(panel.getByRole('button', { name: 'Change priority' })).toContainText('High')

    await panel.getByRole('button', { name: 'Change assignee' }).click()
    await page.getByPlaceholder('Assign to...').fill(me.email)
    await page.getByRole('option', { name: me.display_name || me.email }).click()

    await panel.getByRole('button', { name: 'Change labels' }).click()
    await page.getByRole('option', { name: 'Bug' }).click()
    await page.keyboard.press('Escape')
    await expect(panel.getByRole('button', { name: 'Change labels' })).toContainText('Bug')

    await panel.getByRole('button', { name: 'Change estimate' }).click()
    await page.getByRole('option', { name: '3 points', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Change estimate' })).toContainText('3 points')

    await panel.getByLabel('Due date', { exact: true }).fill('2026-12-24')
    await expect(panel).toContainText('Dec 24')

    await panel.getByRole('button', { name: 'Change cycle' }).click()
    await page.getByRole('option', { name: 'Sprint 1' }).click()
    await expect(panel.getByRole('button', { name: 'Change cycle' })).toContainText('Sprint 1')

    await panel.getByRole('button', { name: 'Change project' }).click()
    await page.getByRole('option', { name: 'Billing revamp' }).click()
    await expect(panel.getByRole('button', { name: 'Change project' })).toContainText(
      'Billing revamp'
    )

    await expect
      .poll(async () => {
        const saved = await getIssue(api, user, issue.id)
        return [
          saved.state_id,
          saved.priority,
          saved.assignee_id,
          saved.labels.map(l => l.id),
          saved.estimate,
          saved.due_date,
          saved.cycle_id,
          saved.project_id,
        ]
      })
      .toEqual([state('In Progress').id, 2, me.id, [bug.id], 3, '2026-12-24', cycle.id, project.id])

    // Readable values in the timeline, not ids.
    const activity = page.getByRole('list', { name: 'Activity' })
    await expect(activity.getByText(/changed status from Todo to In Progress/)).toBeVisible()
    await expect(activity.getByText(/set priority to High/)).toBeVisible()
    await expect(activity.getByText(/added label Bug/)).toBeVisible()
    await expect(activity.getByText(/set the due date to Dec 24/)).toBeVisible()
    await expect(activity.getByText(/added the issue to Sprint 1/)).toBeVisible()
    await expect(activity.getByText(/moved the issue to project Billing revamp/)).toBeVisible()

    await panel.getByLabel('Due date', { exact: true }).hover()
    await panel.getByRole('button', { name: 'Remove due date' }).click()
    await expect.poll(async () => (await getIssue(api, user, issue.id)).due_date).toBeNull()
    const rows = await listActivity(api, user, issue.id)
    expect(rows.find(r => r.field === 'state')).toMatchObject({
      from_value: 'Todo',
      to_value: 'In Progress',
    })
  })

  test('creates sub-issues inline and shows progress and the parent link', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team, state } = await seedWorkspace(api, user)
    const parent = await createIssue(api, user, { team_id: team.id, title: 'Launch v2' })
    await openIssue(page, workspace.url_key, parent.identifier)

    await page.getByRole('button', { name: 'Add sub-issues' }).click()
    const input = page.getByRole('textbox', { name: 'Sub-issue title' })
    await input.fill('Write the docs')
    await input.press('Enter')
    await expect(input).toHaveValue('')
    await input.fill('Ship the release')
    await input.press('Enter')

    const section = page.getByRole('region', { name: 'Sub-issues' })
    await expect(section.getByRole('link')).toHaveCount(2)
    await expect(section.getByTestId('sub-issues-progress')).toHaveText('0/2')

    const subIssues = await listSubIssues(api, user, parent.id)
    expect(subIssues.items.map(i => i.title)).toEqual(['Write the docs', 'Ship the release'])
    await updateIssue(api, user, subIssues.items[0].id, { state_id: state('Done').id })
    await page.reload()
    await expect(section.getByTestId('sub-issues-progress')).toHaveText('1/2')

    // The sub-issue page links back to its parent.
    await section.getByRole('link', { name: /Ship the release/ }).click()
    await expect(page).toHaveURL(issueUrl(workspace.url_key, subIssues.items[1].identifier))
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', {
        name: parent.identifier,
      })
    ).toBeVisible()
    await page.getByRole('link', { name: /Sub-issue of/ }).click()
    await expect(page).toHaveURL(issueUrl(workspace.url_key, parent.identifier))
  })

  test('adds and removes relations', async ({ api, user, authedPage: page }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Payments page' })
    const blocker = await createIssue(api, user, { team_id: team.id, title: 'Payments API' })
    const blocked = await createIssue(api, user, { team_id: team.id, title: 'Checkout flow' })
    // Seeded the other way: "Checkout flow" is blocked by this issue.
    const seeded = await createRelation(api, user, blocked.id, {
      related_issue_id: issue.id,
      type: 'blocked_by',
    })
    await openIssue(page, workspace.url_key, issue.identifier)
    const relations = page.getByRole('region', { name: 'Relations' })
    await expect(relations.getByRole('group', { name: 'Blocking' })).toContainText('Checkout flow')

    await relations.getByRole('button', { name: 'Add relation' }).click()
    await page.getByRole('option', { name: 'Blocked by' }).click()
    await page.getByPlaceholder('Search issues...').fill('Payments API')
    await page.getByRole('option', { name: /Payments API/ }).click()

    const blockedBy = relations.getByRole('group', { name: 'Blocked by' })
    await expect(blockedBy).toContainText(blocker.identifier)
    await expect
      .poll(async () =>
        (await listRelations(api, user, issue.id)).map(r => [r.type, r.direction, r.issue.id])
      )
      .toEqual([
        ['blocks', 'outgoing', blocked.id],
        ['blocks', 'incoming', blocker.id],
      ])

    // The other issue sees the inverse relation.
    expect((await listRelations(api, user, blocker.id))[0]).toMatchObject({
      direction: 'outgoing',
      issue: { id: issue.id },
    })

    await blockedBy.hover()
    await relations
      .getByRole('button', { name: `Remove relation to ${blocker.identifier}` })
      .click()
    await expect(blockedBy).toHaveCount(0)
    await deleteRelation(api, user, seeded.id)
    await page.reload()
    await expect(relations.getByText('No related issues')).toBeVisible()
  })

  test('comments: add with Cmd+Enter, edit, delete, and issue links', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const other = await createIssue(api, user, { team_id: team.id, title: 'Linked issue' })
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Discussed issue' })
    await createComment(api, user, issue.id, `<p>Seeded, see ${other.identifier}</p>`)
    await openIssue(page, workspace.url_key, issue.identifier)

    const composer = page.getByRole('textbox', { name: 'Comment', exact: true })
    await composer.click()
    await page.keyboard.type('Looks good to me')
    await page.keyboard.press('ControlOrMeta+Enter')
    const timeline = page.getByRole('list', { name: 'Activity' })
    const card = timeline.getByRole('article').filter({ hasText: 'Looks good to me' })
    await expect(card).toBeVisible()
    await expect(composer).toHaveText('')

    let comments = await listComments(api, user, issue.id)
    expect(comments.map(c => c.body)).toEqual([
      `<p>Seeded, see ${other.identifier}</p>`,
      '<p>Looks good to me</p>',
    ])

    await card.hover()
    await card.getByRole('button', { name: 'Comment actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const editor = card.getByRole('textbox', { name: 'Edit comment' })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(', ship it')
    await card.getByRole('button', { name: 'Save' }).click()
    await expect(card).toContainText('Looks good to me, ship it')
    await expect(card).toContainText('(edited)')
    comments = await listComments(api, user, issue.id)
    expect(comments[1].edited_at).not.toBeNull()

    // An edit through the API shows after a reload, too.
    await updateComment(api, user, comments[0].id, `<p>Edited, see ${other.identifier}</p>`)
    await page.reload()
    const seededCard = timeline.getByRole('article').filter({ hasText: 'Edited, see' })
    await expect(seededCard).toBeVisible()

    await card.hover()
    await card.getByRole('button', { name: 'Comment actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(card).toHaveCount(0)
    await expect.poll(async () => (await listComments(api, user, issue.id)).length).toBe(1)

    // ENG-1 in a comment links to that issue.
    await seededCard.getByRole('link', { name: other.identifier }).click()
    await expect(page).toHaveURL(issueUrl(workspace.url_key, other.identifier))
    await expect(page.getByRole('textbox', { name: 'Issue title' })).toHaveValue('Linked issue')
  })

  test("a teammate's comment notifies subscribers and cannot be edited by others", async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const teammate = await registerUser(api)
    const teammateUser = await addWorkspaceMember(api, workspace.id, teammate)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Shared issue' })

    await createComment(api, teammate, issue.id, '<p>Can I take this one?</p>')
    // The creator (a subscriber) gets a "commented" notification; the author is now subscribed.
    const notifications = await listNotifications(api, user, workspace.id)
    expect(notifications.map(n => [n.type, n.actor?.id])).toEqual([['commented', teammateUser.id]])
    expect((await listSubscribers(api, user, issue.id)).map(u => u.id)).toContain(teammateUser.id)

    await openIssue(page, workspace.url_key, issue.identifier)
    const card = page.getByRole('article').filter({ hasText: 'Can I take this one?' })
    await expect(card).toBeVisible()
    await card.hover()
    await expect(card.getByRole('button', { name: 'Comment actions' })).toHaveCount(0)
  })

  test('subscribe and unsubscribe', async ({ api, user, authedPage: page }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const me = await getMe(api, user)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Watch me' })
    await openIssue(page, workspace.url_key, issue.identifier)
    const activity = page.getByRole('region', { name: 'Activity' })

    // The creator is subscribed.
    await activity.getByRole('button', { name: 'Unsubscribe' }).click()
    await expect(activity.getByRole('button', { name: 'Subscribe' })).toBeVisible()
    await expect.poll(async () => (await listSubscribers(api, user, issue.id)).length).toBe(0)

    await activity.getByRole('button', { name: 'Subscribe' }).click()
    await expect(activity.getByRole('button', { name: 'Unsubscribe' })).toBeVisible()
    await expect
      .poll(async () => (await listSubscribers(api, user, issue.id)).map(u => u.id))
      .toEqual([me.id])

    // Changes made elsewhere show after a reload.
    await unsubscribe(api, user, issue.id)
    await page.reload()
    await expect(activity.getByRole('button', { name: 'Subscribe' })).toBeVisible()
    await subscribe(api, user, issue.id, me.id)
    await page.reload()
    await expect(activity.getByRole('button', { name: 'Unsubscribe' })).toBeVisible()
  })

  test('copies the identifier, archives, restores and deletes', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Short lived' })
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await openIssue(page, workspace.url_key, issue.identifier)

    await page.getByRole('button', { name: 'Copy issue ID' }).click()
    await expect(page.getByText('Copied ID to clipboard')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(issue.identifier)
    await page.getByRole('button', { name: 'Copy issue URL' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      `/${workspace.url_key}/issue/${issue.identifier}`
    )

    await page.getByRole('button', { name: 'Issue actions' }).click()
    await page.getByRole('menuitem', { name: 'Archive issue' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'archived' })).toBeVisible()
    await expect.poll(async () => (await getIssue(api, user, issue.id)).archived_at).not.toBeNull()

    await page.getByRole('button', { name: 'Restore' }).click()
    await expect.poll(async () => (await getIssue(api, user, issue.id)).archived_at).toBeNull()
    await expect(page.getByRole('list', { name: 'Activity' })).toContainText('restored the issue')

    await page.getByRole('button', { name: 'Issue actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete issue' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText(`Delete issue ${issue.identifier}?`)
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(`/${workspace.url_key}/team/${team.key}/issues`)
    const response = await api.get(`/issues/${issue.id}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(response.status()).toBe(404)
  })

  test('keyboard shortcuts open the pickers, assign to me and rename', async ({
    api,
    user,
    authedPage: page,
  }) => {
    const { workspace, team, state } = await seedWorkspace(api, user)
    const me = await getMe(api, user)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Keyboard first' })
    await openIssue(page, workspace.url_key, issue.identifier)
    const panel = page.getByRole('complementary', { name: 'Issue properties' })
    // Wait until the page has loaded its data (subscribers come with the timeline).
    await expect(
      page.getByRole('region', { name: 'Activity' }).getByRole('button', { name: 'Unsubscribe' })
    ).toBeEnabled()

    await page.keyboard.press('s')
    await expect(page.getByPlaceholder('Change status...')).toBeFocused()
    await page.keyboard.type('Done')
    await page.keyboard.press('Enter')
    await expect(panel.getByRole('button', { name: 'Change status' })).toContainText('Done')
    await expect(page.getByPlaceholder('Change status...')).toBeHidden()

    await page.keyboard.press('p')
    await expect(page.getByPlaceholder('Set priority to...')).toBeVisible()
    // Number keys pick an option while the search box is empty.
    await page.keyboard.press('1')
    await expect(panel.getByRole('button', { name: 'Change priority' })).toContainText('Urgent')
    await expect(page.getByPlaceholder('Set priority to...')).toBeHidden()

    await page.keyboard.press('i')
    await expect(panel.getByRole('button', { name: 'Change assignee' })).toContainText(
      me.display_name || me.email
    )

    await page.keyboard.press('r')
    const title = page.getByRole('textbox', { name: 'Issue title' })
    await expect(title).toBeFocused()
    await title.fill('Keyboard only')
    await title.press('Enter')

    await expect
      .poll(async () => {
        const saved = await getIssue(api, user, issue.id)
        return [saved.state_id, saved.priority, saved.assignee_id, saved.title]
      })
      .toEqual([state('Done').id, 1, me.id, 'Keyboard only'])

    await page.keyboard.press('Shift+S')
    await expect.poll(async () => (await listSubscribers(api, user, issue.id)).length).toBe(0)

    await page.keyboard.press('ControlOrMeta+Backspace')
    await expect(page.getByRole('alertdialog')).toContainText(`Delete issue ${issue.identifier}?`)
    await page.keyboard.press('Escape')
  })

  test('adds the issue to favorites', async ({ api, user, authedPage: page }) => {
    const { workspace, team } = await seedWorkspace(api, user)
    const issue = await createIssue(api, user, { team_id: team.id, title: 'Starred issue' })
    await openIssue(page, workspace.url_key, issue.identifier)

    await page.getByRole('button', { name: 'Add to favorites' }).click()
    await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible()
    await expect
      .poll(async () => (await listFavorites(api, user, workspace.id)).map(f => f.entity_id))
      .toEqual([issue.id])
  })

  test('an unknown identifier shows "Issue not found"', async ({ api, user, authedPage: page }) => {
    const { workspace } = await seedWorkspace(api, user)
    await page.goto(`/${workspace.url_key}/issue/ENG-999`)
    await expect(page.getByText('Issue not found')).toBeVisible()
  })
})
