import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { api } from '@/lib/api-client'
import { API } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type { CreateLabelData, Label, UpdateLabelData } from '@/types/label'
import type {
  CreateTeamData,
  CreateWorkflowStateData,
  Team,
  TeamMember,
  UpdateTeamData,
  UpdateWorkflowStateData,
  WorkflowState,
} from '@/types/team'
import type { UpdateUserData, User } from '@/types/user'
import type {
  CreateWorkspaceData,
  InviteMemberData,
  UpdateMemberData,
  UpdateWorkspaceData,
  Workspace,
  WorkspaceMember,
} from '@/types/workspace'

// Workspace settings (WS-1..WS-7): onboarding, workspace, members, teams,
// workflow states, labels and the profile. Reads that the whole app shares
// (teams, members, labels, states) live in useWorkspace.ts.

/** The signed-in user's membership in the current workspace, and whether they are an admin. */
export function useMyMembership() {
  const { members, me } = useCurrentWorkspace()
  const membership = members.find(member => member.user_id === me.id)
  return { membership, isAdmin: membership?.role === 'admin' }
}

// --- Workspace -----------------------------------------------------------------

export function useCreateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWorkspaceData) => api.post<Workspace>(API.WORKSPACES.CREATE, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}

export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateWorkspaceData) =>
      api.patch<Workspace>(API.WORKSPACES.DETAIL(workspaceId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}

export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(API.WORKSPACES.DETAIL(workspaceId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}

// --- Members -------------------------------------------------------------------

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InviteMemberData) =>
      api.post<WorkspaceMember>(API.WORKSPACES.MEMBERS(workspaceId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}

export function useUpdateMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, ...data }: UpdateMemberData & { memberId: string }) =>
      api.patch<WorkspaceMember>(API.WORKSPACES.MEMBER(workspaceId, memberId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}

/** Remove a member (admins), or leave the workspace (your own member id). */
export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => api.delete(API.WORKSPACES.MEMBER(workspaceId, memberId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })
    },
  })
}

// --- Teams ---------------------------------------------------------------------

export function useCreateTeam(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTeamData) => api.post<Team>(API.WORKSPACES.TEAMS(workspaceId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
  })
}

export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateTeamData) => api.patch<Team>(API.TEAMS.DETAIL(teamId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })
      // A new key changes every issue identifier.
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}

export function useDeleteTeam(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(API.TEAMS.DETAIL(teamId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.members(teamId ?? ''),
    queryFn: () => api.get<TeamMember[]>(API.TEAMS.MEMBERS(teamId ?? '')),
    enabled: !!teamId,
  })
}

/** Members of several teams at once (team list in settings): `teamId -> members`. */
export function useMembersOfTeams(teamIds: string[]) {
  return useQueries({
    queries: teamIds.map(teamId => ({
      queryKey: queryKeys.teams.members(teamId),
      queryFn: () => api.get<TeamMember[]>(API.TEAMS.MEMBERS(teamId)),
    })),
    combine: results => {
      const byTeam = new Map<string, TeamMember[]>()
      results.forEach((result, index) => {
        if (result.data) byTeam.set(teamIds[index], result.data)
      })
      return byTeam
    },
  })
}

/** Join the team (no `user_id`) or add a workspace member to it. */
export function useAddTeamMember(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId?: string) =>
      api.post<TeamMember>(API.TEAMS.MEMBERS(teamId), userId ? { user_id: userId } : {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
  })
}

/** Remove a member from the team; `'me'` leaves it. */
export function useRemoveTeamMember(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete(API.TEAMS.MEMBER(teamId, userId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
  })
}

// --- Workflow states -----------------------------------------------------------

export function useCreateWorkflowState(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWorkflowStateData) =>
      api.post<WorkflowState>(API.TEAMS.STATES(teamId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
  })
}

export function useUpdateWorkflowState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stateId, ...data }: UpdateWorkflowStateData & { stateId: string }) =>
      api.patch<WorkflowState>(API.WORKFLOW_STATES.DETAIL(stateId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}

/** Delete a state; with `moveToStateId` its issues move there first. */
export function useDeleteWorkflowState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stateId, moveToStateId }: { stateId: string; moveToStateId?: string }) =>
      api.delete(
        moveToStateId
          ? `${API.WORKFLOW_STATES.DETAIL(stateId)}?move_to_state_id=${encodeURIComponent(moveToStateId)}`
          : API.WORKFLOW_STATES.DETAIL(stateId)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}

// --- Labels --------------------------------------------------------------------

export function useCreateLabel(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLabelData) =>
      api.post<Label>(API.WORKSPACES.LABELS(workspaceId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.labels.all }),
  })
}

export function useUpdateLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ labelId, ...data }: UpdateLabelData & { labelId: string }) =>
      api.patch<Label>(API.LABELS.DETAIL(labelId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (labelId: string) => api.delete(API.LABELS.DETAIL(labelId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}

// --- Profile -------------------------------------------------------------------

export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateUserData) => api.patch<User>(API.USERS.ME, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me.all })
      // Embedded user names (members, assignees) change too.
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
    },
  })
}
