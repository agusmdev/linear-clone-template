/**
 * Contract checks for the workspace core API (workspaces, teams, states, labels,
 * issues) through the seeding helpers in fixtures.ts. The UI specs of each
 * feature build on these helpers.
 */
import {
  createIssue,
  createWorkspace,
  deleteIssue,
  expect,
  getIssue,
  getIssueByIdentifier,
  getMe,
  getWorkspaceByUrlKey,
  listIssues,
  listLabels,
  listMembers,
  listStates,
  listTeams,
  listWorkspaces,
  registerUser,
  test,
  updateIssue,
} from './fixtures'

test.describe('workspace core API', () => {
  test('a new workspace has a team, default states and labels, and the creator as admin', async ({
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user, { name: 'Acme' })

    expect((await listWorkspaces(api, user)).map(w => w.id)).toContain(workspace.id)
    expect((await getWorkspaceByUrlKey(api, user, workspace.url_key)).id).toBe(workspace.id)

    const me = await getMe(api, user)
    const members = await listMembers(api, user, workspace.id)
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ user_id: me.id, role: 'admin' })

    const teams = await listTeams(api, user, workspace.id)
    expect(teams.map(t => t.key)).toEqual(['ENG'])

    const states = await listStates(api, user, teams[0].id)
    expect(states.map(s => s.type)).toEqual(
      expect.arrayContaining(['backlog', 'unstarted', 'started', 'completed', 'canceled'])
    )
    expect(states).toHaveLength(6)

    expect(await listLabels(api, user, workspace.id)).toHaveLength(3)
  })

  test('issues get team identifiers and can be read, updated and deleted', async ({
    api,
    user,
  }) => {
    const workspace = await createWorkspace(api, user)
    const [team] = await listTeams(api, user, workspace.id)

    const first = await createIssue(api, user, { team_id: team.id, title: 'First issue' })
    const second = await createIssue(api, user, {
      team_id: team.id,
      title: 'Second issue',
      priority: 1,
    })
    expect([first.identifier, second.identifier]).toEqual(['ENG-1', 'ENG-2'])

    const byIdentifier = await getIssueByIdentifier(api, user, workspace.id, 'ENG-2')
    expect(byIdentifier).toMatchObject({ id: second.id, priority: 1 })

    const states = await listStates(api, user, team.id)
    const done = states.find(s => s.type === 'completed')
    if (!done) throw new Error('No completed state')
    const updated = await updateIssue(api, user, first.id, { state_id: done.id })
    expect(updated.state.type).toBe('completed')
    expect(updated.completed_at).not.toBeNull()
    expect((await getIssue(api, user, first.id)).state.id).toBe(done.id)

    await deleteIssue(api, user, second.id)
    const page = await listIssues(api, user, workspace.id)
    expect(page.items.map(i => i.id)).toEqual([first.id])
  })

  test('a non-member cannot see the workspace', async ({ api, user }) => {
    const workspace = await createWorkspace(api, user)
    const stranger = await registerUser(api)
    const response = await api.get(`/workspaces/${workspace.url_key}`, {
      headers: { Authorization: `Bearer ${stranger.token}` },
    })
    expect(response.status()).toBe(404)
  })
})
