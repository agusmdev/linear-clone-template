import { PRIORITY_LABELS } from '@/components/PriorityIcon'
import { formatDueDate } from '@/lib/relative-time'
import type { IssueActivity, IssuePriority } from '@/types/issue'

/** One piece of an activity line: plain text, or a value shown in the strong text color. */
export interface ActivityPart {
  text: string
  strong?: boolean
}

const t = (text: string): ActivityPart => ({ text })
const v = (text: string): ActivityPart => ({ text, strong: true })

function priorityName(value: string | null): string {
  const priority = Number(value ?? 0) as IssuePriority
  return PRIORITY_LABELS[priority] ?? `Priority ${value}`
}

function splitLabels(value: string | null): string[] {
  return value ? value.split(', ').filter(Boolean) : []
}

function points(value: string): string {
  return `${value} ${value === '1' ? 'point' : 'points'}`
}

/** What the actor did, after the actor's name (Linear wording). */
export function describeActivity(activity: IssueActivity): ActivityPart[] {
  const { action, field, from_value: from, to_value: to } = activity
  if (action === 'created') return [t('created the issue')]
  if (action === 'archived') return [t('archived the issue')]
  if (action === 'unarchived') return [t('restored the issue')]
  if (action === 'commented') return [t('commented')]

  switch (field) {
    case 'title':
      return [t('changed the title from '), v(from ?? ''), t(' to '), v(to ?? '')]
    case 'description':
      return [t('updated the description')]
    case 'state':
      return from
        ? [t('changed status from '), v(from), t(' to '), v(to ?? '')]
        : [t('set status to '), v(to ?? '')]
    case 'priority':
      if (!to || to === '0') return [t('removed priority')]
      return [t('set priority to '), v(priorityName(to))]
    case 'assignee':
      if (!to) return [t('unassigned '), v(from ?? 'the issue')]
      if (!from) return [t('assigned the issue to '), v(to)]
      return [t('reassigned from '), v(from), t(' to '), v(to)]
    case 'labels': {
      const before = splitLabels(from)
      const after = splitLabels(to)
      const added = after.filter(label => !before.includes(label))
      const removed = before.filter(label => !after.includes(label))
      const parts: ActivityPart[] = []
      if (added.length) {
        parts.push(t(added.length === 1 ? 'added label ' : 'added labels '), v(added.join(', ')))
      }
      if (removed.length) {
        if (parts.length) parts.push(t(' and '))
        parts.push(
          t(removed.length === 1 ? 'removed label ' : 'removed labels '),
          v(removed.join(', '))
        )
      }
      return parts.length ? parts : [t('changed labels')]
    }
    case 'project':
      if (!to) return [t('removed the issue from project '), v(from ?? '')]
      return [t('moved the issue to project '), v(to)]
    case 'cycle':
      if (!to) return [t('removed the issue from '), v(from ?? 'its cycle')]
      return from
        ? [t('moved the issue from '), v(from), t(' to '), v(to)]
        : [t('added the issue to '), v(to)]
    case 'parent':
      if (!to) return [t('removed the parent issue '), v(from ?? '')]
      return [t('set the parent issue to '), v(to)]
    case 'sub_issue':
      if (!to) return [t('removed sub-issue '), v(from ?? '')]
      return [t('added sub-issue '), v(to)]
    case 'relation_blocks':
      if (!to) return [t('removed blocking relation with '), v(from ?? '')]
      return [t('marked this as blocking '), v(to)]
    case 'relation_blocked_by':
      if (!to) return [t('removed blocked by relation with '), v(from ?? '')]
      return [t('marked this as blocked by '), v(to)]
    case 'relation_related':
      if (!to) return [t('removed related issue '), v(from ?? '')]
      return [t('marked this as related to '), v(to)]
    case 'relation_duplicate_of':
      if (!to) return [t('removed duplicate relation with '), v(from ?? '')]
      return [t('marked this as a duplicate of '), v(to)]
    case 'relation_duplicated_by':
      if (!to) return [t('removed duplicate relation with '), v(from ?? '')]
      return [t('marked '), v(to), t(' as a duplicate of this issue')]
    case 'estimate':
      if (!to) return [t('removed the estimate')]
      return [t('set the estimate to '), v(points(to))]
    case 'due_date':
      if (!to) return [t('removed the due date')]
      return [t('set the due date to '), v(formatDueDate(to))]
    default:
      return [t(`changed ${field ?? 'the issue'}`)]
  }
}

/**
 * Drops the rows the timeline does not show as lines (comments are cards) and
 * folds description edits in a row by the same person into one line
 * (autosave writes one row per save).
 */
export function foldActivity(rows: IssueActivity[]): IssueActivity[] {
  const result: IssueActivity[] = []
  for (const row of rows) {
    if (row.action === 'commented') continue
    const previous = result.at(-1)
    if (
      previous &&
      row.field === 'description' &&
      previous.field === 'description' &&
      previous.actor_id === row.actor_id
    ) {
      result[result.length - 1] = row
      continue
    }
    result.push(row)
  }
  return result
}
