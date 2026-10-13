import { useEffect } from 'react'
import { setPageIssueDefaults } from '@/lib/issue-events'
import type { CreateIssueEventDetail } from '@/types/issue'

/**
 * While the calling page is mounted, `C` and "Create new issue" prefill these
 * values (e.g. the project or the cycle of the page).
 */
export function usePageIssueDefaults(detail: CreateIssueEventDetail): void {
  const key = JSON.stringify(detail)
  useEffect(() => setPageIssueDefaults(JSON.parse(key) as CreateIssueEventDetail), [key])
}
