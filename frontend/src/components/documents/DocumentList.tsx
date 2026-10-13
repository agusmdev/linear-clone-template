import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { FileText, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { formatRelativeTime } from '@/features/documents/relative-time'
import { useNewDocument } from '@/features/documents/useNewDocument'
import { useDocuments } from '@/hooks/useDocuments'
import type { DocumentSummary } from '@/types/document'
import { DocumentIcon } from './DocumentIcon'

export interface DocumentListParams {
  project_id?: string
  team_id?: string
}

interface DocumentListProps {
  /** Scope of the list: a project's or a team's documents. Empty = the whole workspace. */
  params: DocumentListParams
  /** Search in title and content. */
  search?: string
  /** Replaces the default empty state (shown when there is no document and no search). */
  emptyState?: ReactNode
}

/**
 * The documents of the current workspace (or of one project / team), newest
 * edit first. Mount it anywhere under the workspace layout, e.g. a project's
 * "Documents" tab: `<DocumentList params={{ project_id }} />`.
 */
export function DocumentList({ params, search, emptyState }: DocumentListProps) {
  const { workspace } = useCurrentWorkspace()
  const query = useDocuments({
    workspace_id: workspace.id,
    size: 100,
    ...params,
    search: search?.trim() || undefined,
  })
  const { createAndOpen, isPending } = useNewDocument(params)

  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading documents">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex h-11 items-center gap-3 border-b border-border-subtle px-4">
            <Skeleton className="size-4" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={<FileText />}
        title="Could not load documents"
        description={query.error.message}
        action={
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  const documents = query.data.items
  if (documents.length === 0) {
    if (search?.trim()) {
      return (
        <EmptyState
          icon={<FileText />}
          title="No documents found"
          description={`No document matches "${search.trim()}".`}
        />
      )
    }
    return (
      emptyState ?? (
        <EmptyState
          icon={<FileText />}
          title="No documents"
          description="Write specs, notes and plans next to your issues."
          action={
            <Button size="sm" onClick={() => void createAndOpen()} disabled={isPending}>
              <Plus />
              New document
            </Button>
          }
        />
      )
    )
  }

  return (
    <ul aria-label="Documents" className="flex flex-col">
      {documents.map(document => (
        <DocumentRow key={document.id} document={document} />
      ))}
    </ul>
  )
}

function DocumentRow({ document }: { document: DocumentSummary }) {
  const { path } = useCurrentWorkspace()
  const editor = document.last_edited_by ?? document.creator
  const editorName = editor ? editor.name || editor.email : null
  return (
    <li>
      <Link
        to={path(`/document/${document.id}`) as '/'}
        className="group flex h-11 items-center gap-3 border-b border-border-subtle px-4 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
      >
        <DocumentIcon icon={document.icon} />
        <span className="min-w-0 flex-1 truncate text-ui text-foreground">{document.title}</span>
        {document.project ? (
          <Badge className="hidden max-w-48 sm:inline-flex" title={document.project.name}>
            <span className="truncate">{document.project.name}</span>
          </Badge>
        ) : null}
        <span className="flex shrink-0 items-center gap-2 text-mini text-text-tertiary">
          {editorName ? <UserAvatar name={editorName} size="xs" /> : null}
          <span className="hidden md:inline">{editorName}</span>
          <time
            dateTime={document.updated_at}
            title={new Date(document.updated_at).toLocaleString()}
          >
            {formatRelativeTime(document.updated_at)}
          </time>
        </span>
      </Link>
    </li>
  )
}
