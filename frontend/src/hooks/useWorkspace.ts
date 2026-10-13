import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type { Label } from '@/types/label'
import type { Team, WorkflowState } from '@/types/team'
import type { User } from '@/types/user'
import type { Workspace, WorkspaceMember } from '@/types/workspace'

/** The signed-in user (GET /users/me). */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me.all,
    queryFn: () => api.get<User>(API.USERS.ME),
  })
}

/** Workspaces the signed-in user is a member of. */
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => api.get<Workspace[]>(API.WORKSPACES.LIST),
  })
}

export function useWorkspaceByKey(urlKey: string) {
  return useQuery({
    queryKey: queryKeys.workspaces.byUrlKey(urlKey),
    queryFn: () => api.get<Workspace>(API.WORKSPACES.BY_URL_KEY(urlKey)),
    retry: false,
  })
}

export function useTeams(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.list(workspaceId ?? ''),
    queryFn: () => api.get<Team[]>(API.WORKSPACES.TEAMS(workspaceId ?? '')),
    enabled: !!workspaceId,
  })
}

export function useMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId ?? ''),
    queryFn: () => api.get<WorkspaceMember[]>(API.WORKSPACES.MEMBERS(workspaceId ?? '')),
    enabled: !!workspaceId,
  })
}

export function useLabels(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.labels.list(workspaceId ?? ''),
    queryFn: () => api.get<Label[]>(API.WORKSPACES.LABELS(workspaceId ?? '')),
    enabled: !!workspaceId,
  })
}

export function useTeamStates(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.states(teamId ?? ''),
    queryFn: () => api.get<WorkflowState[]>(API.TEAMS.STATES(teamId ?? '')),
    enabled: !!teamId,
  })
}
