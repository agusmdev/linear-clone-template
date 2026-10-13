import type { UserSummary } from '@/types/user'

/** Planned: /documents endpoints (see docs/API.md). The list returns it without `content`. */
export interface DocumentSummary {
  id: string
  workspace_id: string
  project_id: string | null
  team_id: string | null
  title: string
  icon: string | null
  creator_id: string | null
  creator: UserSummary | null
  last_edited_by_id: string | null
  last_edited_by: UserSummary | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Document extends DocumentSummary {
  /** HTML from the TipTap editor. */
  content: string
}

export interface CreateDocumentData {
  workspace_id: string
  title: string
  content?: string
  icon?: string | null
  project_id?: string | null
  team_id?: string | null
}

export type UpdateDocumentData = Partial<Omit<CreateDocumentData, 'workspace_id'>> & {
  sort_order?: number
}

export interface DocumentsParams {
  workspace_id: string
  page?: number
  size?: number
  project_id?: string
  team_id?: string
  search?: string
  order_by?: string[]
}
