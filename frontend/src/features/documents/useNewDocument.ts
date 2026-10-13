import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useCreateDocument } from '@/hooks/useDocuments'
import { toastApiError } from '@/lib/error-handler'

export interface NewDocumentScope {
  project_id?: string
  team_id?: string
}

// The scope of the open page (a project, a team), set by `usePageDocumentScope`.
let pageScope: { scope: NewDocumentScope } | null = null

/**
 * While the calling page is mounted, the command menu's "Create new document"
 * creates the document in this scope, like the page's own "New document".
 */
export function usePageDocumentScope(scope: NewDocumentScope): void {
  const key = JSON.stringify(scope)
  useEffect(() => {
    const entry = { scope: JSON.parse(key) as NewDocumentScope }
    pageScope = entry
    return () => {
      if (pageScope === entry) pageScope = null
    }
  }, [key])
}

/** The scope of the open page (see `usePageDocumentScope`), else none. */
export function currentPageDocumentScope(): NewDocumentScope {
  return pageScope?.scope ?? {}
}

/**
 * "New document": creates an "Untitled" document (optionally in a project or
 * team) and opens it in the full-page editor.
 */
export function useNewDocument(scope: NewDocumentScope = {}) {
  const { workspace, path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const create = useCreateDocument()

  /** `extra` adds to (and wins over) the hook's scope. */
  const createAndOpen = async (extra: NewDocumentScope = {}) => {
    try {
      const document = await create.mutateAsync({
        workspace_id: workspace.id,
        title: 'Untitled',
        ...scope,
        ...extra,
      })
      await navigate({ to: path(`/document/${document.id}`) as '/' })
    } catch (error) {
      toastApiError(error, 'Could not create document')
    }
  }

  return { createAndOpen, isPending: create.isPending }
}
