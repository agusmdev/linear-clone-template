import { createFileRoute } from '@tanstack/react-router'
import { DocumentsListPage } from '@/features/documents/DocumentsListPage'

/** DOC-1: every document of the workspace, with search and "New document". */
export const Route = createFileRoute('/_authed/$workspaceKey/documents')({
  component: DocumentsPage,
})

function DocumentsPage() {
  return <DocumentsListPage />
}
