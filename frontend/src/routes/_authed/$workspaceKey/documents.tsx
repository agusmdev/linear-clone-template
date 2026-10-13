import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileText, Plus, Search } from 'lucide-react'
import { DocumentList } from '@/components/documents/DocumentList'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useNewDocument } from '@/features/documents/useNewDocument'
import { useDebounce } from '@/hooks/useDebounce'

/** DOC-1: every document of the workspace, with search and "New document". */
export const Route = createFileRoute('/_authed/$workspaceKey/documents')({
  component: DocumentsPage,
})

function DocumentsPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const { createAndOpen, isPending } = useNewDocument()

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
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
      <DocumentList params={{}} search={debouncedSearch} />
    </div>
  )
}
