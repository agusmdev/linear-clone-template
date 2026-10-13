import { useNavigate } from '@tanstack/react-router'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useCreateDocument } from '@/hooks/useDocuments'
import { toastApiError } from '@/lib/error-handler'

export interface NewDocumentScope {
  project_id?: string
  team_id?: string
}

/**
 * "New document": creates an "Untitled" document (optionally in a project or
 * team) and opens it in the full-page editor.
 */
export function useNewDocument(scope: NewDocumentScope = {}) {
  const { workspace, path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const create = useCreateDocument()

  const createAndOpen = async () => {
    try {
      const document = await create.mutateAsync({
        workspace_id: workspace.id,
        title: 'Untitled',
        ...scope,
      })
      await navigate({ to: path(`/document/${document.id}`) as '/' })
    } catch (error) {
      toastApiError(error, 'Could not create document')
    }
  }

  return { createAndOpen, isPending: create.isPending }
}
