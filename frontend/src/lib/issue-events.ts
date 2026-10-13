import type { CreateIssueEventDetail } from '@/types/issue'

/** Window event that opens the create-issue modal (mounted once in the workspace layout). */
export const CREATE_ISSUE_EVENT = 'linear:create-issue'

/** Opens the create-issue modal from anywhere, with optional defaults. */
export function openCreateIssue(detail: CreateIssueEventDetail = {}): void {
  window.dispatchEvent(new CustomEvent<CreateIssueEventDetail>(CREATE_ISSUE_EVENT, { detail }))
}

// The defaults of the open page (a project, a cycle), set by `usePageIssueDefaults`.
let pageDefaults: { detail: CreateIssueEventDetail } | null = null

/** Sets the defaults of the open page until the returned cleanup runs. */
export function setPageIssueDefaults(detail: CreateIssueEventDetail): () => void {
  const entry = { detail }
  pageDefaults = entry
  return () => {
    if (pageDefaults === entry) pageDefaults = null
  }
}

/** Opens the create-issue modal with the defaults of the open page (the `C` shortcut). */
export function openCreateIssueHere(): void {
  openCreateIssue(pageDefaults?.detail ?? {})
}
