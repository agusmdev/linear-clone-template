import { Archive, Mail, MailOpen } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { fullDateTime, timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/notification'

/** What happened, without the actor: "assigned you", "changed status to Done", ... */
export function notificationMessage(notification: Notification): string {
  switch (notification.type) {
    case 'assigned':
      return 'assigned you'
    case 'commented':
      return 'commented'
    case 'mentioned':
      return 'mentioned you'
    case 'status_changed':
      return notification.issue
        ? `changed status to ${notification.issue.state.name}`
        : 'changed the status'
  }
}

/** Display name of the notification's actor ("Someone" when the user is gone). */
export function notificationActorName(notification: Notification): string {
  return notification.actor?.name || notification.actor?.email || 'Someone'
}

interface NotificationRowProps {
  notification: Notification
  selected: boolean
  onSelect: () => void
  onToggleRead: () => void
  onArchive: () => void
}

/** One inbox row: actor avatar, issue identifier + title, message, time, unread dot. */
export function NotificationRow({
  notification,
  selected,
  onSelect,
  onToggleRead,
  onArchive,
}: NotificationRowProps) {
  const unread = !notification.read_at
  const actor = notificationActorName(notification)
  const issue = notification.issue
  return (
    <li
      data-notification-id={notification.id}
      data-unread={unread || undefined}
      data-selected={selected || undefined}
      className={cn(
        'group relative border-b border-border-subtle',
        selected ? 'bg-surface-active' : 'hover:bg-surface-hover'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
      >
        <UserAvatar name={actor} size="md" className="mt-0.5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            {issue ? (
              <>
                <span className="shrink-0 text-mini text-text-tertiary">{issue.identifier}</span>
                <span
                  className={cn(
                    'truncate text-ui',
                    unread ? 'font-medium text-foreground' : 'text-text-secondary'
                  )}
                >
                  {issue.title}
                </span>
              </>
            ) : (
              <span className="truncate text-ui text-text-secondary">Deleted issue</span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-mini text-text-secondary">
            {issue && notification.type === 'status_changed' ? (
              <StatusIcon type={issue.state.type} color={issue.state.color} size={12} />
            ) : null}
            <span className="truncate">
              {actor} {notificationMessage(notification)}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <time
            dateTime={notification.created_at}
            title={fullDateTime(notification.created_at)}
            className="text-mini text-text-tertiary group-hover:invisible group-has-[:focus-visible]:invisible"
          >
            {timeAgo(notification.created_at)}
          </time>
          {unread ? (
            <span
              role="img"
              aria-label="Unread"
              className="size-2 rounded-full bg-primary group-has-[:focus-visible]:opacity-0 group-hover:opacity-0"
            />
          ) : null}
        </span>
      </button>
      <div className="invisible absolute top-2 right-3 flex items-center gap-0.5 rounded-md bg-popover shadow-popover group-has-[:focus-visible]:visible group-hover:visible">
        <IconButton
          size="sm"
          label={unread ? 'Mark as read' : 'Mark as unread'}
          shortcut="U"
          icon={unread ? <MailOpen /> : <Mail />}
          onClick={onToggleRead}
        />
        <IconButton size="sm" label="Archive" shortcut="E" icon={<Archive />} onClick={onArchive} />
      </div>
    </li>
  )
}
