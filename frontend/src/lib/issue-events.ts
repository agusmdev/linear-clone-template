import type { CreateIssueEventDetail } from '@/types/issue'

/** Window event that opens the create-issue modal (mounted once in the workspace layout). */
export const CREATE_ISSUE_EVENT = 'linear:create-issue'

/** Opens the create-issue modal from anywhere, with optional defaults. */
export function openCreateIssue(detail: CreateIssueEventDetail = {}): void {
  window.dispatchEvent(new CustomEvent<CreateIssueEventDetail>(CREATE_ISSUE_EVENT, { detail }))
}
