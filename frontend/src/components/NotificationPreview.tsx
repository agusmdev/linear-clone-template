import { Link } from '@tanstack/react-router'
import { Archive, ArchiveRestore, ArrowUpRight, Mail, MailOpen, Trash2 } from 'lucide-react'
import { RichTextContent } from '@/components/editor'
import { IconButton } from '@/components/IconButton'
import { notificationActorName, notificationMessage } from '@/components/NotificationRow'
import { PriorityIcon, PRIORITY_LABELS } from '@/components/PriorityIcon'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fullDateTime, timeAgo } from '@/lib/time-ago'
import { cn } from '@/lib/utils'
import type { Issue } from '@/types/issue'
import type { Notification } from '@/types/notification'

interface NotificationPreviewProps {
  notification: Notification
  /** The full issue (description, assignee, ...); undefined while it loads. */
  issue: Issue | undefined
  issueLoading: boolean
  /** In-app path of the issue page, or null when the issue is gone. */
  issueHref: string | null
  onToggleRead: () => void
  onToggleArchive: () => void
  onDelete: () => void
}

/** Right pane of the inbox: the selected notification's issue. */
export function NotificationPreview({
  notification,
  issue,
  issueLoading,
  issueHref,
  onToggleRead,
  onToggleArchive,
  onDelete,
}: NotificationPreviewProps) {
  const ref = notification.issue
  const unread = !notification.read_at
  const archived = !!notification.archived_at
  const state = issue?.state ?? ref?.state
  const assigneeName = issue?.assignee ? issue.assignee.name || issue.assignee.email : null
  return (
    <section aria-label="Notification preview" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle px-4">
        <span className="min-w-0 flex-1 truncate text-ui text-text-secondary">
          {ref ? ref.identifier : 'Deleted issue'}
        </span>
        <IconButton
          label={unread ? 'Mark as read' : 'Mark as unread'}
          shortcut="U"
          icon={unread ? <MailOpen /> : <Mail />}
          onClick={onToggleRead}
        />
        <IconButton
          label={archived ? 'Unarchive' : 'Archive'}
          shortcut="E"
          icon={archived ? <ArchiveRestore /> : <Archive />}
          onClick={onToggleArchive}
        />
        <IconButton
          label="Delete notification"
          shortcut="Backspace"
          icon={<Trash2 />}
          onClick={onDelete}
        />
        {issueHref ? (
          <Link
            to={issueHref as '/'}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'ml-1 gap-1.5')}
          >
            Open issue
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-8 py-8">
          <div className="flex items-center gap-2 text-mini text-text-secondary">
            <UserAvatar name={notificationActorName(notification)} size="xs" />
            <span>
              <span className="text-foreground">{notificationActorName(notification)}</span>{' '}
              {notificationMessage(notification)}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={notification.created_at} title={fullDateTime(notification.created_at)}>
              {timeAgo(notification.created_at)}
            </time>
          </div>

          {ref ? (
            <>
              <h2 className="text-title font-semibold text-foreground">
                {issue?.title ?? ref.title}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-mini text-text-secondary">
                {state ? (
                  <span className="flex items-center gap-1.5" data-testid="preview-status">
                    <StatusIcon type={state.type} color={state.color} />
                    {state.name}
                  </span>
                ) : null}
                {issue ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <PriorityIcon priority={issue.priority} />
                      {PRIORITY_LABELS[issue.priority]}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UserAvatar name={assigneeName} size="xs" />
                      {assigneeName ?? 'Unassigned'}
                    </span>
                    {issue.labels.map(label => (
                      <span key={label.id} className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                      </span>
                    ))}
                  </>
                ) : null}
              </div>

              <div className="border-t border-border-subtle pt-5">
                {issueLoading ? (
                  <div className="flex flex-col gap-2" aria-busy="true">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : issue?.description ? (
                  <RichTextContent html={issue.description} />
                ) : (
                  <p className="text-ui text-text-tertiary">No description</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-ui text-text-secondary">This issue was deleted.</p>
          )}
        </div>
      </div>
    </section>
  )
}
