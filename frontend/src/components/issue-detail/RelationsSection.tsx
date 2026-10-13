import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Ban, Copy, Link2, Plus, ShieldAlert, X } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { StatusIcon } from '@/components/StatusIcon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IssueSearchPicker } from '@/components/issue-detail/IssueSearchPicker'
import type { CreateIssueRelationData, IssueRef, IssueRelation } from '@/types/issue'

export type RelationKind = CreateIssueRelationData['type']

/** The add-menu entries, in Linear's order. */
const KINDS: { type: RelationKind; label: string; icon: React.ReactNode }[] = [
  { type: 'blocked_by', label: 'Blocked by', icon: <Ban /> },
  { type: 'blocks', label: 'Blocking', icon: <ShieldAlert /> },
  { type: 'related', label: 'Related to', icon: <Link2 /> },
  { type: 'duplicate', label: 'Duplicate of', icon: <Copy /> },
]

/** The heading of a relation as seen from the current issue. */
export function relationHeading(relation: Pick<IssueRelation, 'type' | 'direction'>): string {
  if (relation.type === 'blocks')
    return relation.direction === 'outgoing' ? 'Blocking' : 'Blocked by'
  if (relation.type === 'duplicate')
    return relation.direction === 'outgoing' ? 'Duplicate of' : 'Duplicated by'
  return 'Related to'
}

const HEADING_ORDER = ['Blocked by', 'Blocking', 'Related to', 'Duplicate of', 'Duplicated by']

interface RelationsSectionProps {
  relations: IssueRelation[]
  /** Ids that cannot be picked (the issue itself). */
  excludeIds: string[]
  issuePath: (identifier: string) => string
  onAdd: (type: RelationKind, issue: IssueRef) => void
  onRemove: (relation: IssueRelation) => void
  search: string
  onSearchChange: (search: string) => void
  searchResults: IssueRef[]
  searching?: boolean
}

/** "Relations" block: grouped compact rows (Blocked by, Blocking, ...) and an add menu. */
export function RelationsSection({
  relations,
  excludeIds,
  issuePath,
  onAdd,
  onRemove,
  search,
  onSearchChange,
  searchResults,
  searching,
}: RelationsSectionProps) {
  const [pending, setPending] = React.useState<RelationKind | null>(null)
  // Set when a menu item opens the picker: the menu must not take the focus back.
  const picked = React.useRef(false)
  const groups = new Map<string, IssueRelation[]>()
  for (const relation of relations) {
    const heading = relationHeading(relation)
    groups.set(heading, [...(groups.get(heading) ?? []), relation])
  }
  const ordered = HEADING_ORDER.filter(heading => groups.has(heading))
  const linkedIds = new Set([...excludeIds, ...relations.map(r => r.issue.id)])
  const pendingLabel = KINDS.find(kind => kind.type === pending)?.label ?? 'Issues'

  return (
    <section aria-label="Relations" className="flex flex-col">
      <IssueSearchPicker
        open={pending !== null}
        onOpenChange={open => {
          if (!open) {
            setPending(null)
            onSearchChange('')
          }
        }}
        label={pendingLabel}
        search={search}
        onSearchChange={onSearchChange}
        results={searchResults.filter(issue => !linkedIds.has(issue.id))}
        loading={searching}
        onSelect={issue => {
          if (pending) onAdd(pending, issue)
          setPending(null)
          onSearchChange('')
        }}
        anchor={
          <div className="flex h-8 items-center gap-2">
            <h2 className="text-ui font-medium text-foreground">Relations</h2>
            {relations.length > 0 ? (
              <span className="text-mini text-text-tertiary">{relations.length}</span>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Add relation" icon={<Plus />} size="sm" className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44"
                onCloseAutoFocus={event => {
                  if (!picked.current) return
                  picked.current = false
                  event.preventDefault()
                }}
              >
                {KINDS.map(kind => (
                  <DropdownMenuItem
                    key={kind.type}
                    onSelect={() => {
                      picked.current = true
                      setPending(kind.type)
                    }}
                  >
                    {kind.icon}
                    {kind.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      {ordered.length === 0 ? (
        <p className="text-mini text-text-tertiary">No related issues</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ordered.map(heading => (
            <div key={heading} role="group" aria-label={heading}>
              <h3 className="mb-0.5 text-mini text-text-secondary">{heading}</h3>
              <ul className="rounded-lg border border-border-subtle">
                {(groups.get(heading) ?? []).map(relation => (
                  <li
                    key={relation.id}
                    className="group flex h-9 items-center gap-2.5 border-b border-border-subtle px-2 text-ui last:border-b-0 hover:bg-surface-hover"
                  >
                    <StatusIcon
                      type={relation.issue.state.type}
                      color={relation.issue.state.color}
                      label={relation.issue.state.name}
                    />
                    <Link
                      to={issuePath(relation.issue.identifier) as '/'}
                      className="flex min-w-0 flex-1 items-center gap-2.5"
                    >
                      <span className="w-14 shrink-0 text-mini text-text-tertiary">
                        {relation.issue.identifier}
                      </span>
                      <span className="truncate text-foreground">{relation.issue.title}</span>
                    </Link>
                    <IconButton
                      label={`Remove relation to ${relation.issue.identifier}`}
                      icon={<X />}
                      size="sm"
                      tooltip={false}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => onRemove(relation)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
