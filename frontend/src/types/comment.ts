import type { UserSummary } from '@/types/user'

/** Planned: GET /issues/{id}/comments (see docs/API.md). */
export interface Comment {
  id: string
  issue_id: string
  user_id: string | null
  user: UserSummary | null
  /** HTML from the TipTap editor. */
  body: string
  edited_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateCommentData {
  body: string
}

export type UpdateCommentData = CreateCommentData
