import { useState } from 'react'
import { FileText, Plus, Search } from 'lucide-react'
import { DocumentList } from '@/components/documents/DocumentList'
import { PageHeader, type Breadcrumb } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useNewDocument } from '@/features/documents/useNewDocument'
import { useDebounce } from '@/hooks/useDebounce'

interface DocumentsListPageProps {
  /** Only the documents of this team; "New document" makes them in this team. */
  teamId?: string
  /** Parent pages before the "Documents" title (e.g. the team). */
  breadcrumbs?: Breadcrumb[]
}

/**
 * The "Documents" page: search, "New document" and the list. Used by the
 * workspace page (`/<ws>/documents`) and a team page (`/<ws>/team/<key>/documents`).
 */
export function DocumentsListPage({ teamId, breadcrumbs }: DocumentsListPageProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const params = teamId ? { team_id: teamId } : {}
  const { createAndOpen, isPending } = useNewDocument(params)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Documents"
        icon={<FileText className="size-4 text-text-secondary" aria-hidden />}
        actions={
          <Button size="sm" onClick={() => void createAndOpen()} disabled={isPending}>
            <Plus />
            New document
          </Button>
        }
      >
        <label className="flex h-7 w-full max-w-72 items-center gap-2 rounded-md border border-border bg-input px-2 text-text-tertiary focus-within:border-primary/60">
          <Search className="size-3.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search documents..."
            aria-label="Search documents"
            className="h-full min-w-0 flex-1 bg-transparent text-ui text-foreground outline-none placeholder:text-text-tertiary"
          />
        </label>
      </PageHeader>
      <DocumentList params={params} search={debouncedSearch} />
    </div>
  )
}
