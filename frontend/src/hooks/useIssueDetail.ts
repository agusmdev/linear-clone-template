import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API, buildIssuesListUrl } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import { invalidateIssueCaches } from '@/hooks/useIssues'
import type { Comment, CreateCommentData, UpdateCommentData } from '@/types/comment'
import type {
  CreateIssueData,
  CreateIssueRelationData,
  Issue,
  IssueActivity,
  IssueRelation,
  SubIssues,
  UpdateIssueData,
} from '@/types/issue'
import type { Page } from '@/types/page'
import type { UserSummary } from '@/types/user'

/**
 * The issue page: one issue by its identifier (`ENG-12`), archived issues too.
 * Always refetched when the page opens: the description editor starts from this
 * data, so a cached copy would hide (and its saves overwrite) a teammate's edits.
 */
export function useIssueByIdentifier(workspaceId: string, identifier: string) {
  return useQuery({
    queryKey: queryKeys.issues.byIdentifier(workspaceId, identifier.toUpperCase()),
    queryFn: () => api.get<Issue>(API.ISSUES.BY_IDENTIFIER(workspaceId, identifier)),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

/** Identifies the PATCH /issues/{id} mutations of the issue page (see `useIsMutating`). */
export function issueUpdateMutationKey(issueId: string) {
  return ['issues', 'update', issueId] as const
}

/** One issue by id (e.g. the parent of a sub-issue). Disabled without an id. */
export function useIssue(issueId: string | null) {
  return useQuery({
    queryKey: queryKeys.issues.detail(issueId ?? ''),
    queryFn: () => api.get<Issue>(API.ISSUES.DETAIL(issueId ?? '')),
    enabled: !!issueId,
  })
}

/**
 * PATCH /issues/{id}. The issue page's cache entry (`byIdentifier`) is updated
 * at once with the server answer; every issue query is refreshed after.
 */
export interface UpdateIssueDetailVariables {
  data: UpdateIssueData
  /** Set when the page is being reloaded or closed, so the save is not cancelled. */
  keepalive?: boolean
}

export function useUpdateIssueDetail(issue: Pick<Issue, 'id' | 'workspace_id' | 'identifier'>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: issueUpdateMutationKey(issue.id),
    mutationFn: ({ data, keepalive }: UpdateIssueDetailVariables) =>
      api.patch<Issue>(API.ISSUES.DETAIL(issue.id), data, { keepalive }),
    onSuccess: updated => {
      queryClient.setQueryData(
        queryKeys.issues.byIdentifier(issue.workspace_id, issue.identifier),
        updated
      )
    },
    onSettled: (_data, _error, { data }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
      // Cycle progress counts the issue's state and cycle.
      if ('cycle_id' in data || 'state_id' in data || 'archived' in data) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cycles.all })
      }
      // Project progress too.
      if ('project_id' in data || 'state_id' in data || 'archived' in data) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      }
      // Sidebar favorites show the issue title.
      if ('title' in data) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
      }
    },
  })
}

/**
 * DELETE /issues/{id}. `onDeleted` runs first (the issue page navigates away
 * in it). Only then are the deleted issue's queries removed and the issue
 * caches refreshed: while the issue page is still mounted, a refresh or a
 * re-render fetches the deleted issue again and gets 404s.
 */
export function useDeleteIssueDetail(
  issue: Pick<Issue, 'id' | 'workspace_id' | 'identifier'>,
  onDeleted: () => unknown
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(API.ISSUES.DETAIL(issue.id)),
    onSuccess: async () => {
      // detail(id) is the prefix of the sub-resources (comments, relations, ...).
      const deletedKeys = [
        queryKeys.issues.detail(issue.id),
        queryKeys.issues.byIdentifier(issue.workspace_id, issue.identifier),
      ]
      await Promise.all(deletedKeys.map(queryKey => queryClient.cancelQueries({ queryKey })))
      await onDeleted()
      for (const queryKey of deletedKeys) queryClient.removeQueries({ queryKey })
      await invalidateIssueCaches(queryClient)
    },
  })
}

/** POST /issues with `parent_id`: a new sub-issue. */
export function useCreateSubIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateIssueData) => api.post<Issue>(API.ISSUES.CREATE, data),
    onSuccess: () => invalidateIssueCaches(queryClient),
  })
}

export function useSubIssues(issueId: string) {
  return useQuery({
    queryKey: queryKeys.issueDetail.subIssues(issueId),
    queryFn: () => api.get<SubIssues>(API.ISSUE_DETAIL.SUB_ISSUES(issueId)),
  })
}

/** Issue search for pickers (relations): title, description or identifier. */
export function useIssueSearch(workspaceId: string, search: string, enabled = true) {
  const params = { workspace_id: workspaceId, search: search.trim() || undefined, size: 20 }
  return useQuery({
    queryKey: queryKeys.issues.list(params),
    queryFn: () => api.get<Page<Issue>>(buildIssuesListUrl(params)),
    enabled,
    placeholderData: keepPreviousData,
  })
}

// --- Comments ---------------------------------------------------------------

export function useComments(issueId: string) {
  return useQuery({
    queryKey: queryKeys.issueDetail.comments(issueId),
    queryFn: () => api.get<Comment[]>(API.ISSUE_DETAIL.COMMENTS(issueId)),
  })
}

export function useCreateComment(issueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCommentData) =>
      api.post<Comment>(API.ISSUE_DETAIL.COMMENTS(issueId), data),
    // Comments, activity and subscribers (the author is subscribed) change.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId) }),
  })
}

export function useUpdateComment(issueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: string; data: UpdateCommentData }) =>
      api.patch<Comment>(API.ISSUE_DETAIL.COMMENT(commentId), data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.issueDetail.comments(issueId) }),
  })
}

export function useDeleteComment(issueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => api.delete(API.ISSUE_DETAIL.COMMENT(commentId)),
    onMutate: async commentId => {
      const key = queryKeys.issueDetail.comments(issueId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Comment[]>(key)
      queryClient.setQueryData<Comment[]>(key, old => old?.filter(c => c.id !== commentId))
      return { previous }
    },
    onError: (_error, _commentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.issueDetail.comments(issueId), context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.issueDetail.comments(issueId) }),
  })
}

// --- Relations --------------------------------------------------------------

export function useRelations(issueId: string) {
  return useQuery({
    queryKey: queryKeys.issueDetail.relations(issueId),
    queryFn: () => api.get<IssueRelation[]>(API.ISSUE_DETAIL.RELATIONS(issueId)),
  })
}

export function useCreateRelation(issueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateIssueRelationData) =>
      api.post<IssueRelation>(API.ISSUE_DETAIL.RELATIONS(issueId), data),
    // The other issue's relations change too.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.issues.all }),
  })
}

export function useDeleteRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (relationId: string) => api.delete(API.ISSUE_DETAIL.RELATION(relationId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.issues.all }),
  })
}

// --- Activity and subscribers ----------------------------------------------

export function useIssueActivity(issueId: string) {
  return useQuery({
    queryKey: queryKeys.issueDetail.activity(issueId),
    queryFn: () => api.get<IssueActivity[]>(API.ISSUE_DETAIL.ACTIVITY(issueId)),
  })
}

export function useSubscribers(issueId: string) {
  return useQuery({
    queryKey: queryKeys.issueDetail.subscribers(issueId),
    queryFn: () => api.get<UserSummary[]>(API.ISSUE_DETAIL.SUBSCRIBERS(issueId)),
  })
}

/** Subscribe (`true`) or unsubscribe (`false`) the current user. */
export function useToggleSubscription(issueId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subscribe: boolean) =>
      subscribe
        ? api.postNoContent(API.ISSUE_DETAIL.SUBSCRIBERS(issueId), {})
        : api.delete(API.ISSUE_DETAIL.SUBSCRIBER(issueId, 'me')),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.issueDetail.subscribers(issueId) }),
  })
}
