import type { IssueRef } from '@/types/issue'
import type { UserSummary } from '@/types/user'

export type NotificationType = 'assigned' | 'commented' | 'status_changed' | 'mentioned'

/** GET /notifications (see docs/API.md). `issue` and `actor` are null when deleted. */
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

/** Query of GET /notifications. `workspace_id` is required. */
export interface NotificationsParams {
  workspace_id: string
  /** true: only unread; false: only read; undefined: both. */
  unread?: boolean
  include_archived?: boolean
  type?: NotificationType
  issue_id?: string
  page?: number
  size?: number
}

export interface UnreadNotificationCount {
  count: number
}

export interface MarkAllNotificationsReadResponse {
  updated: number
}
