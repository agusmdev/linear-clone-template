import type { UserSummary } from '@/types/user'

export type WorkspaceRole = 'admin' | 'member'

export interface Workspace {
  id: string
  name: string
  /** Slug of the app URL: `/<url_key>/...`. Lowercase letters, digits and dashes. */
  url_key: string
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateWorkspaceData {
  name: string
  url_key: string
  /** Default "Engineering". */
  team_name?: string
  /** 2-5 uppercase letters. Default: from the team name ("Engineering" -> "ENG"). */
  team_key?: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
  user: UserSummary
}

/** Planned: POST /workspaces/{id}/members (see docs/API.md). */
export interface InviteMemberData {
  email: string
  role?: WorkspaceRole
}
