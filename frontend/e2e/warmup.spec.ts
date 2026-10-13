/**
 * Runs once, before every other spec (the "warmup" project in
 * playwright.config.ts). The Vite dev server compiles each module on its
 * first request and re-bundles dependencies it discovers late, which reloads
 * the page. Opening the main pages here makes that happen before the parallel
 * workers start, so no real test meets a blank, still-compiling page.
 */
import { createDocument, createIssue, createWorkspace, expect, listTeams, test } from './fixtures'

test('warms up the dev server on the main pages', async ({ api, user, authedPage: page }) => {
  test.setTimeout(240_000)
  const workspace = await createWorkspace(api, user)
  const [team] = await listTeams(api, user, workspace.id)
  const issue = await createIssue(api, user, { team_id: team.id, title: 'Warm-up issue' })
  const doc = await createDocument(api, user, { workspace_id: workspace.id, title: 'Warm-up doc' })
  const ws = `/${workspace.url_key}`

  const pages: [string, RegExp][] = [
    [`${ws}/my-issues`, /My issues/],
    [`${ws}/team/${team.key}/issues`, /Issues/],
    [`${ws}/issue/${issue.identifier}`, /Warm-up issue/],
    [`${ws}/documents`, /Documents/],
    [`${ws}/document/${doc.id}`, /Documents/],
    [`${ws}/projects`, /Projects/],
    [`${ws}/team/${team.key}/cycles`, /Cycles/],
    [`${ws}/inbox`, /Inbox/],
    [`${ws}/search`, /Search/],
    [`${ws}/settings/teams`, /Teams/],
  ]
  for (const [path, text] of pages) {
    await page.goto(path)
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 60_000 })
  }
})
