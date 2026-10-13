import * as React from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { RichTextContent, RichTextEditor } from '@/components/editor'
import { IconButton } from '@/components/IconButton'
import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { describeActivity, foldActivity } from '@/components/issue-detail/activity-text'
import { formatDateTime, formatRelativeTime } from '@/lib/relative-time'
import type { Comment } from '@/types/comment'
import type { IssueActivity } from '@/types/issue'

/** The part of a DOM or React mouse event an issue link click needs. */
export interface IssueLinkClick {
  metaKey: boolean
  ctrlKey: boolean
  preventDefault: () => void
}

interface IssueLinkProps {
  /** Turns `ENG-12` text into a link (see RichTextEditor). */
  renderIssueHref?: (identifier: string) => string | null | undefined
  onIssueClick?: (identifier: string, event: IssueLinkClick) => void
}

interface IssueTimelineProps extends IssueLinkProps {
  activity: IssueActivity[]
  comments: Comment[]
  /** The signed-in user: only their comments get Edit / Delete. */
  meId: string
  onEditComment: (comment: Comment, body: string) => Promise<unknown>
  onDeleteComment: (comment: Comment) => void
}

type Entry =
  | { kind: 'activity'; at: string; activity: IssueActivity }
  | { kind: 'comment'; at: string; comment: Comment }

function isEmptyHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === ''
  )
}

function TimeAgo({ iso }: { iso: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={iso} className="text-text-tertiary">
          {formatRelativeTime(iso)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(iso)}</TooltipContent>
    </Tooltip>
  )
}

function ActivityLine({ activity }: { activity: IssueActivity }) {
  const actor = activity.actor ? activity.actor.name || activity.actor.email : 'Someone'
  return (
    <li className="flex items-start gap-2.5 py-1.5 pl-1 text-mini text-text-secondary">
      <span className="mt-px flex size-5 shrink-0 items-center justify-center">
        <UserAvatar name={actor} size="xs" />
      </span>
      <p className="min-w-0 leading-5" data-testid="activity-line">
        <span className="font-medium text-foreground">{actor}</span>{' '}
        {describeActivity(activity).map((part, index) =>
          part.strong ? (
            <span key={index} className="font-medium text-foreground">
              {part.text}
            </span>
          ) : (
            <React.Fragment key={index}>{part.text}</React.Fragment>
          )
        )}
        <span aria-hidden> · </span>
        <TimeAgo iso={activity.created_at} />
      </p>
    </li>
  )
}

function CommentCard({
  comment,
  mine,
  onEdit,
  onDelete,
  renderIssueHref,
  onIssueClick,
}: {
  comment: Comment
  mine: boolean
  onEdit: (body: string) => Promise<unknown>
  onDelete: () => void
} & IssueLinkProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(comment.body)
  const [saving, setSaving] = React.useState(false)
  const author = comment.user ? comment.user.name || comment.user.email : 'Deleted user'

  const save = async () => {
    if (isEmptyHtml(draft) || saving) return
    setSaving(true)
    try {
      await onEdit(draft)
      setEditing(false)
    } catch {
      // The page shows the error toast; stay in edit mode.
    } finally {
      setSaving(false)
    }
  }

  return (
    <li>
      <article
        aria-label={`Comment by ${author}`}
        className="group rounded-lg border border-border-subtle bg-surface px-3.5 py-3"
      >
        <header className="flex items-center gap-2 text-mini">
          <UserAvatar name={author} size="sm" />
          <span className="font-medium text-foreground">{author}</span>
          <TimeAgo iso={comment.created_at} />
          {comment.edited_at ? <span className="text-text-tertiary">(edited)</span> : null}
          {mine && !editing ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  label="Comment actions"
                  icon={<MoreHorizontal />}
                  size="sm"
                  tooltip={false}
                  className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  onSelect={() => {
                    setDraft(comment.body)
                    setEditing(true)
                  }}
                >
                  <Pencil />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </header>
        {editing ? (
          <div
            className="mt-2"
            onKeyDownCapture={event => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                event.stopPropagation()
                void save()
              } else if (event.key === 'Escape') {
                setEditing(false)
              }
            }}
          >
            <RichTextEditor
              value={draft}
              onChange={setDraft}
              autofocus
              ariaLabel="Edit comment"
              placeholder="Leave a comment…"
              renderIssueHref={renderIssueHref}
              onIssueClick={onIssueClick}
              className="min-h-12"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={isEmptyHtml(draft) || saving} onClick={() => void save()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <RichTextContent
            html={comment.body}
            renderIssueHref={renderIssueHref}
            onIssueClick={onIssueClick}
            className="mt-1.5 pl-7"
          />
        )}
      </article>
    </li>
  )
}

/** Activity lines and comment cards in one list, oldest first (Linear's issue timeline). */
export function IssueTimeline({
  activity,
  comments,
  meId,
  onEditComment,
  onDeleteComment,
  renderIssueHref,
  onIssueClick,
}: IssueTimelineProps) {
  const entries: Entry[] = [
    ...foldActivity(activity).map(row => ({
      kind: 'activity' as const,
      at: row.created_at,
      activity: row,
    })),
    ...comments.map(comment => ({
      kind: 'comment' as const,
      at: comment.created_at,
      comment,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <ol aria-label="Activity" className="flex flex-col gap-1">
      {entries.map(entry =>
        entry.kind === 'activity' ? (
          <ActivityLine key={`a-${entry.activity.id}`} activity={entry.activity} />
        ) : (
          <CommentCard
            key={`c-${entry.comment.id}`}
            comment={entry.comment}
            mine={entry.comment.user_id === meId}
            onEdit={body => onEditComment(entry.comment, body)}
            onDelete={() => onDeleteComment(entry.comment)}
            renderIssueHref={renderIssueHref}
            onIssueClick={onIssueClick}
          />
        )
      )}
    </ol>
  )
}

interface CommentComposerProps extends IssueLinkProps {
  onSubmit: (body: string) => Promise<unknown>
  submitting?: boolean
}

/** "Leave a comment…" box under the timeline. Cmd/Ctrl+Enter sends. */
export function CommentComposer({
  onSubmit,
  submitting,
  renderIssueHref,
  onIssueClick,
}: CommentComposerProps) {
  const [body, setBody] = React.useState('')
  // A new editor after each send: the editor ignores outside value changes while focused.
  const [round, setRound] = React.useState(0)
  const empty = isEmptyHtml(body)

  const send = async () => {
    if (empty || submitting) return
    try {
      await onSubmit(body)
      setBody('')
      setRound(r => r + 1)
    } catch {
      // The page shows the error toast; keep the text.
    }
  }

  return (
    <div
      className="rounded-lg border border-border bg-surface px-3.5 pt-2.5 pb-2 transition-colors focus-within:border-text-tertiary"
      onKeyDownCapture={event => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          event.stopPropagation()
          void send()
        }
      }}
    >
      <RichTextEditor
        key={round}
        value={body}
        onChange={setBody}
        autofocus={round > 0}
        ariaLabel="Comment"
        placeholder="Leave a comment…"
        renderIssueHref={renderIssueHref}
        onIssueClick={onIssueClick}
        className="min-h-10"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-micro text-text-tertiary">⌘ + Enter to send</span>
        <Button size="sm" disabled={empty || submitting} onClick={() => void send()}>
          Comment
        </Button>
      </div>
    </div>
  )
}
