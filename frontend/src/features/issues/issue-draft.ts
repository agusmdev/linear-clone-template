import { z } from 'zod'
import { createIssueSchema, type CreateIssueFormData } from './issue-schemas'

// A draft may have no title yet (only a description).
const draftSchema = createIssueSchema.extend({ title: z.string().max(500) })

const draftKey = (workspaceId: string) => `issue-draft:${workspaceId}`

/** True when the form holds text the user would lose on close (title or description). */
export function hasDraftContent(values: Pick<CreateIssueFormData, 'title' | 'description'>) {
  return values.title.trim() !== '' || values.description.trim() !== ''
}

/** The saved create-issue draft of a workspace ("Save draft" in the close prompt). */
export function readIssueDraft(workspaceId: string): CreateIssueFormData | null {
  try {
    const raw = localStorage.getItem(draftKey(workspaceId))
    if (!raw) return null
    const parsed = draftSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null // storage blocked or a corrupt value: no draft
  }
}

export function saveIssueDraft(workspaceId: string, draft: CreateIssueFormData): void {
  try {
    localStorage.setItem(draftKey(workspaceId), JSON.stringify(draft))
  } catch {
    // Storage blocked (private mode): the draft is not kept.
  }
}

export function clearIssueDraft(workspaceId: string): void {
  try {
    localStorage.removeItem(draftKey(workspaceId))
  } catch {
    // Storage blocked: nothing was saved.
  }
}
