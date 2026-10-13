import { createContext, useContext } from 'react'
import type { Label } from '@/types/label'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'
import type { Workspace, WorkspaceMember } from '@/types/workspace'

export interface WorkspaceContextValue {
  workspace: Workspace
  /** Teams of the workspace (sidebar order). */
  teams: Team[]
  /** The teams the user joined (sidebar "Your teams"), in `teams` order. */
  myTeams: Team[]
  members: WorkspaceMember[]
  labels: Label[]
  me: User
  /** Builds an in-app path under the workspace: `path('/my-issues')` -> `/acme/my-issues`. */
  path: (subPath: string) => string
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

/**
 * The workspace of the current URL (`/$workspaceKey/...`). Every page under
 * routes/_authed/$workspaceKey/ can call it: the layout route provides it and
 * renders children only after the workspace, teams, joined teams, members,
 * labels and user
 * have loaded.
 */
export function useCurrentWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useCurrentWorkspace must be used under routes/_authed/$workspaceKey')
  return value
}
