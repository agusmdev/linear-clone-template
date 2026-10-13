import type { IssueRef } from '@/types/issue'
import type { UserSummary } from '@/types/user'

export type NotificationType = 'assigned' | 'commented' | 'status_changed' | 'mentioned'

/** Planned: /notifications endpoints (see docs/API.md). */
export interface Notification {
  id: string
  user_id: string
  workspace_id: string
  issue_id: string | null
  actor_id: string | null
  type: NotificationType
  read_at: string | null
  archived_at: string | null
  created_at: string
  issue: IssueRef | null
  actor: UserSummary | null
}

export interface UpdateNotificationData {
  read?: boolean
  archived?: boolean
}
