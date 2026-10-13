import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API, buildNotificationsListUrl } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type { Issue } from '@/types/issue'
import type {
  MarkAllNotificationsReadResponse,
  Notification,
  NotificationsParams,
  UnreadNotificationCount,
  UpdateNotificationData,
} from '@/types/notification'
import type { Page } from '@/types/page'

/** How often the sidebar badge asks for the unread count. */
export const UNREAD_COUNT_POLL_MS = 30_000

/** My notifications of a workspace, newest first (GET /notifications). */
export function useNotifications(params: NotificationsParams) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => api.get<Page<Notification>>(buildNotificationsListUrl(params)),
    placeholderData: keepPreviousData,
    refetchInterval: UNREAD_COUNT_POLL_MS,
  })
}

/** Unread, not archived notifications (sidebar badge). Polls every 30 s. */
export function useUnreadNotificationCount(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(workspaceId ?? ''),
    queryFn: () =>
      api.get<UnreadNotificationCount>(API.NOTIFICATIONS.UNREAD_COUNT(workspaceId ?? '')),
    enabled: !!workspaceId,
    refetchInterval: UNREAD_COUNT_POLL_MS,
  })
}

/** The full issue of a notification, for the inbox preview (GET /issues/{id}). */
export function useNotificationIssue(issueId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.issues.detail(issueId ?? ''),
    queryFn: () => api.get<Issue>(API.ISSUES.DETAIL(issueId ?? '')),
    enabled: !!issueId,
  })
}

type ListSnapshot = [readonly unknown[], Page<Notification> | undefined][]

/** Applies `change` to every cached notification list; returns the old data for a rollback. */
async function patchLists(
  queryClient: QueryClient,
  change: (page: Page<Notification>, params: NotificationsParams | undefined) => Page<Notification>
): Promise<ListSnapshot> {
  const listKey = ['notifications', 'list'] as const
  await queryClient.cancelQueries({ queryKey: listKey })
  const snapshot = queryClient.getQueriesData<Page<Notification>>({ queryKey: listKey })
  for (const [key, data] of snapshot) {
    if (!data) continue
    queryClient.setQueryData(key, change(data, key[2] as NotificationsParams | undefined))
  }
  return snapshot
}

function restore(queryClient: QueryClient, snapshot: ListSnapshot | undefined) {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data)
}

export function useUpdateNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNotificationData }) =>
      api.patch<Notification>(API.NOTIFICATIONS.DETAIL(id), data),
    onMutate: async ({ id, data }) => {
      const now = new Date().toISOString()
      const snapshot = await patchLists(queryClient, (page, params) => {
        const items = page.items.map(n =>
          n.id !== id
            ? n
            : {
                ...n,
                read_at:
                  data.read === undefined ? n.read_at : data.read ? (n.read_at ?? now) : null,
                archived_at:
                  data.archived === undefined
                    ? n.archived_at
                    : data.archived
                      ? (n.archived_at ?? now)
                      : null,
              }
        )
        // An archived notification leaves the lists that hide archived ones.
        const visible = params?.include_archived ? items : items.filter(n => !n.archived_at)
        return { ...page, items: visible, total: page.total - (items.length - visible.length) }
      })
      return { snapshot }
    },
    onError: (_error, _vars, context) => restore(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workspaceId: string) =>
      api.post<MarkAllNotificationsReadResponse>(API.NOTIFICATIONS.MARK_ALL_READ, {
        workspace_id: workspaceId,
      }),
    onMutate: async () => {
      const now = new Date().toISOString()
      const snapshot = await patchLists(queryClient, page => ({
        ...page,
        items: page.items.map(n => (n.read_at ? n : { ...n, read_at: now })),
      }))
      return { snapshot }
    },
    onError: (_error, _vars, context) => restore(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(API.NOTIFICATIONS.DETAIL(id)),
    onMutate: async id => {
      const snapshot = await patchLists(queryClient, page => {
        const items = page.items.filter(n => n.id !== id)
        return { ...page, items, total: page.total - (page.items.length - items.length) }
      })
      return { snapshot }
    },
    onError: (_error, _vars, context) => restore(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
