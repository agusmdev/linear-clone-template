import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CheckCheck, Inbox as InboxIcon, ListFilter } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { Kbd } from '@/components/Kbd'
import { NotificationPreview } from '@/components/NotificationPreview'
import { NotificationRow } from '@/components/NotificationRow'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useNotificationIssue,
  useNotifications,
  useRefreshNotificationIssue,
  useUpdateNotification,
} from '@/hooks/useNotifications'
import { toastApiError } from '@/lib/error-handler'
import { cn } from '@/lib/utils'
import type { Notification, UpdateNotificationData } from '@/types/notification'

/** Inbox (UX-3): my notifications on the left, the selected one's issue on the right. */
export const Route = createFileRoute('/_authed/$workspaceKey/inbox')({
  component: InboxPage,
})

const PAGE_SIZE = 100

/** Keys typed into a text field or editor are not shortcuts. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

/** The notification id of the row that holds `element`, else null. */
function rowIdOf(element: Element | null): string | null {
  return element?.closest('[data-notification-id]')?.getAttribute('data-notification-id') ?? null
}

function scrollRowIntoView(id: string) {
  const row = document.querySelector(`[data-notification-id="${CSS.escape(id)}"]`)
  row?.scrollIntoView({ block: 'nearest' })
  // Keyboard focus on a row follows the selection, so Enter opens the selected one.
  if (rowIdOf(document.activeElement) !== null) {
    row?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }
}

function InboxPage() {
  const { workspace, path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The selected notification as it was when opened: it stays in the preview
  // when a refetch drops it from the list (e.g. read while "Unread" is on).
  const [sticky, setSticky] = useState<Notification | null>(null)

  const listQuery = useNotifications({
    workspace_id: workspace.id,
    unread: unreadOnly ? true : undefined,
    size: PAGE_SIZE,
  })
  const items = listQuery.data?.items ?? []
  const selected =
    items.find(n => n.id === selectedId) ?? (sticky?.id === selectedId ? sticky : null)
  const issueQuery = useNotificationIssue(selected?.issue_id)
  const refreshIssue = useRefreshNotificationIssue()

  const update = useUpdateNotification()
  const markAllRead = useMarkAllNotificationsRead()
  const remove = useDeleteNotification()

  const issueHref = (n: Notification) => (n.issue ? path(`/issue/${n.issue.identifier}`) : null)

  function change(n: Notification, data: UpdateNotificationData, failure: string) {
    update.mutate({ id: n.id, data }, { onError: error => toastApiError(error, failure) })
  }

  function select(n: Notification) {
    setSelectedId(n.id)
    setSticky(n.read_at ? n : { ...n, read_at: new Date().toISOString() })
    refreshIssue(n.issue_id)
    scrollRowIntoView(n.id)
    if (!n.read_at) change(n, { read: true }, 'Could not mark the notification as read')
  }

  function toggleRead(n: Notification) {
    const read = !n.read_at
    if (sticky?.id === n.id) setSticky({ ...n, read_at: read ? new Date().toISOString() : null })
    change(n, { read }, 'Could not update the notification')
  }

  /** After `n` leaves the list: select its neighbour (next, else previous). */
  function selectNeighbour(n: Notification) {
    if (selectedId !== n.id) return
    const index = items.findIndex(item => item.id === n.id)
    const next = items[index + 1] ?? items[index - 1]
    if (next) select(next)
    else {
      setSelectedId(null)
      setSticky(null)
    }
  }

  function toggleArchive(n: Notification) {
    if (n.archived_at) {
      change(n, { archived: false }, 'Could not unarchive the notification')
      return
    }
    selectNeighbour(n)
    change(n, { archived: true }, 'Could not archive the notification')
    toast('Notification archived', {
      action: {
        label: 'Undo',
        onClick: () => change(n, { archived: false }, 'Could not unarchive the notification'),
      },
    })
  }

  function deleteNotification(n: Notification) {
    selectNeighbour(n)
    remove.mutate(n.id, {
      onError: error => toastApiError(error, 'Could not delete the notification'),
    })
  }

  function markAll() {
    markAllRead.mutate(workspace.id, {
      onSuccess: result =>
        toast.success(
          result.updated === 1
            ? '1 notification marked as read'
            : `${result.updated} notifications marked as read`
        ),
      onError: error => toastApiError(error, 'Could not mark all as read'),
    })
  }

  // Linear's inbox keys: J/K (or arrows) move, U read/unread, E archive,
  // Backspace delete, Enter opens the issue, Esc closes the preview.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      const index = items.findIndex(n => n.id === selectedId)
      const current = index >= 0 ? items[index] : selected
      switch (event.key) {
        case 'j':
        case 'J':
        case 'ArrowDown': {
          const next = index < 0 ? items[0] : items[Math.min(index + 1, items.length - 1)]
          if (next) {
            event.preventDefault()
            select(next)
          }
          return
        }
        case 'k':
        case 'K':
        case 'ArrowUp': {
          const previous = index < 0 ? items[0] : items[Math.max(index - 1, 0)]
          if (previous) {
            event.preventDefault()
            select(previous)
          }
          return
        }
        case 'u':
        case 'U':
          if (current) toggleRead(current)
          return
        case 'e':
        case 'E':
          if (current) toggleArchive(current)
          return
        case 'Backspace':
        case 'Delete':
          if (current) {
            event.preventDefault()
            deleteNotification(current)
          }
          return
        case 'Enter':
        case 'o':
        case 'O': {
          // Enter on a focused button or link clicks it (Archive, another row, a sidebar
          // link); only the selected row's own button opens the issue.
          const control =
            event.key === 'Enter' && event.target instanceof Element
              ? event.target.closest('a, button, [role="button"]')
              : null
          const rowId = control?.parentElement?.getAttribute('data-notification-id')
          if (control && rowId !== current?.id) return
          const href = current ? issueHref(current) : null
          if (href) {
            event.preventDefault()
            void navigate({ to: href as '/' })
          }
          return
        }
        case 'Escape':
          setSelectedId(null)
          setSticky(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const unreadInList = items.some(n => !n.read_at)
  const total = listQuery.data?.total ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Inbox"
        icon={<InboxIcon className="size-4 text-text-secondary" />}
        actions={
          <>
            <IconButton
              label={unreadOnly ? 'Show all notifications' : 'Show unread only'}
              icon={<ListFilter />}
              active={unreadOnly}
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly(value => !value)}
            />
            <IconButton
              label="Mark all as read"
              icon={<CheckCheck />}
              disabled={!unreadInList || markAllRead.isPending}
              onClick={markAll}
            />
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* Phone widths have room for one pane: the preview replaces the list. */}
        <div
          className={cn(
            'min-h-0 w-full shrink-0 flex-col border-r border-border-subtle md:flex md:w-[380px]',
            selected ? 'hidden' : 'flex'
          )}
        >
          {unreadOnly ? (
            <div className="flex h-8 shrink-0 items-center border-b border-border-subtle px-4 text-mini text-text-secondary">
              Unread notifications
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listQuery.isPending ? (
              <div aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="flex h-[60px] items-center gap-3 border-b border-border-subtle px-4"
                  >
                    <Skeleton className="size-6 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<InboxIcon />}
                title={unreadOnly ? 'No unread notifications' : 'No notifications'}
                description={
                  unreadOnly
                    ? 'You are all caught up.'
                    : 'You get a notification when someone assigns you an issue, comments on or changes an issue you subscribe to.'
                }
              />
            ) : (
              <ul aria-label="Notifications">
                {items.map(n => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    selected={n.id === selectedId}
                    onSelect={() => select(n)}
                    onToggleRead={() => toggleRead(n)}
                    onArchive={() => toggleArchive(n)}
                  />
                ))}
              </ul>
            )}
            {total > items.length && items.length > 0 ? (
              <p className="px-4 py-3 text-mini text-text-tertiary">
                Showing the latest {items.length} of {total} notifications.
              </p>
            ) : null}
          </div>
        </div>
        <div className={cn('min-h-0 min-w-0 flex-1 md:flex', selected ? 'flex' : 'hidden')}>
          {selected ? (
            <NotificationPreview
              key={selected.id}
              notification={selected}
              issue={issueQuery.data}
              issueLoading={issueQuery.isPending && !!selected.issue_id}
              issueHref={issueHref(selected)}
              onToggleRead={() => toggleRead(selected)}
              onToggleArchive={() => toggleArchive(selected)}
              onDelete={() => deleteNotification(selected)}
              onBack={() => {
                setSelectedId(null)
                setSticky(null)
              }}
            />
          ) : (
            <EmptyState
              icon={<InboxIcon />}
              title="No notification selected"
              description={
                <>
                  Pick a notification, or move with <Kbd>J</Kbd> and <Kbd>K</Kbd>.
                </>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
