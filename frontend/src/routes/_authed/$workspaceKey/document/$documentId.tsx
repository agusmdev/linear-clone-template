import { useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { FileText, FolderInput, Link2, MoreHorizontal, SmilePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteDocumentDialog } from '@/components/documents/DeleteDocumentDialog'
import { DocumentIcon } from '@/components/documents/DocumentIcon'
import { DocumentIconPicker } from '@/components/documents/DocumentIconPicker'
import { combineSaveStatus, DocumentSaveStatus } from '@/components/documents/DocumentSaveStatus'
import { MoveToProjectPicker, type ProjectChoice } from '@/components/documents/MoveToProjectPicker'
import { type AutosaveStatus, RichTextEditor, useDebouncedAutosave } from '@/components/editor'
import { EmptyState } from '@/components/EmptyState'
import { FavoriteButton } from '@/components/FavoriteButton'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { formatRelativeTime } from '@/features/documents/relative-time'
import { useDeleteDocument, useDocument, useUpdateDocument } from '@/hooks/useDocuments'
import { useProjects } from '@/hooks/useProjects'
import { toastApiError } from '@/lib/error-handler'
import type { Document } from '@/types/document'

/** DOC-3..DOC-5, DOC-7: the full-page document editor with autosave. */
export const Route = createFileRoute('/_authed/$workspaceKey/document/$documentId')({
  component: DocumentPage,
})

function DocumentPage() {
  const { documentId } = Route.useParams()
  const { path } = useCurrentWorkspace()
  const query = useDocument(documentId)

  if (query.isPending) {
    return (
      <div className="flex min-h-full flex-col" aria-busy="true">
        <PageHeader
          breadcrumbs={[{ label: 'Documents', to: path('/documents') }]}
          title={<Skeleton className="h-3.5 w-32" />}
        />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-12">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader
          breadcrumbs={[{ label: 'Documents', to: path('/documents') }]}
          title="Not found"
        />
        <EmptyState
          icon={<FileText />}
          title="Document not found"
          description="It was deleted, or you do not have access to it."
          action={
            <Link
              to={path('/documents') as '/'}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Back to documents
            </Link>
          }
        />
      </div>
    )
  }

  return <DocumentEditor key={query.data.id} document={query.data} />
}

function DocumentEditor({ document }: { document: Document }) {
  const { workspace, path } = useCurrentWorkspace()
  const projectsQuery = useProjects(workspace.id)
  const navigate = useNavigate()
  const update = useUpdateDocument(document.id)
  const remove = useDeleteDocument(document.id)
  // After a delete, the autosave on unmount must not PATCH a missing document.
  const deletedRef = useRef(false)

  const [title, setTitle] = useState(document.title)
  const [content, setContent] = useState(document.content)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const openPickerAfterMenu = useRef(false)

  const titleSave = useDebouncedAutosave(title, next => {
    if (deletedRef.current) return
    return update.mutateAsync({ title: next.trim() || 'Untitled' })
  })
  const contentSave = useDebouncedAutosave(content, next => {
    if (deletedRef.current) return
    return update.mutateAsync({ content: next })
  })
  const [fieldStatus, setFieldStatus] = useState<AutosaveStatus>('idle')
  const status = combineSaveStatus([titleSave.status, contentSave.status, fieldStatus])

  /** Icon and project changes save at once. */
  const saveField = async (data: { icon?: string | null; project_id?: string | null }) => {
    setFieldStatus('saving')
    try {
      await update.mutateAsync(data)
      setFieldStatus('saved')
    } catch (error) {
      setFieldStatus('error')
      toastApiError(error, 'Could not save document')
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const confirmDelete = async () => {
    try {
      deletedRef.current = true
      await remove.mutateAsync()
      setDeleteOpen(false)
      toast.success('Document deleted')
      await navigate({ to: path('/documents') as '/' })
    } catch (error) {
      deletedRef.current = false
      toastApiError(error, 'Could not delete document')
    }
  }

  // "Move to project" shows once the workspace's projects are loaded.
  const projects = useMemo<ProjectChoice[] | undefined>(
    () =>
      // Project icons are icon names (not emoji): the picker shows its default glyph.
      projectsQuery.data?.map(project => ({ id: project.id, name: project.name })),
    [projectsQuery.data]
  )
  const editor = document.last_edited_by ?? document.creator
  const shownTitle = title.trim() || 'Untitled'

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        breadcrumbs={[
          { label: 'Documents', to: path('/documents') },
          ...(document.project
            ? [{ label: document.project.name, to: path(`/project/${document.project.id}`) }]
            : []),
        ]}
        title={shownTitle}
        icon={<DocumentIcon icon={document.icon} size={14} />}
        actions={
          <>
            <DocumentSaveStatus status={status} />
            {editor ? (
              <span
                className="hidden max-w-96 truncate px-2 text-mini text-text-tertiary md:inline"
                data-testid="document-last-edited"
              >
                Last edited by {editor.name || editor.email} ·{' '}
                <time dateTime={document.updated_at}>
                  {formatRelativeTime(document.updated_at)}
                </time>
              </span>
            ) : null}
            {projects ? (
              <MoveToProjectPicker
                projects={projects}
                value={document.project_id}
                open={projectPickerOpen}
                onOpenChange={setProjectPickerOpen}
                onChange={projectId => void saveField({ project_id: projectId })}
              />
            ) : null}
            <FavoriteButton entityType="document" entityId={document.id} />
            <IconButton label="Copy link" icon={<Link2 />} onClick={() => void copyLink()} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Document actions" icon={<MoreHorizontal />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52"
                onCloseAutoFocus={event => {
                  // Open the picker once the menu is gone, or the menu's focus
                  // return closes it at once.
                  if (!openPickerAfterMenu.current) return
                  openPickerAfterMenu.current = false
                  event.preventDefault()
                  setProjectPickerOpen(true)
                }}
              >
                {projects ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      openPickerAfterMenu.current = true
                    }}
                  >
                    <FolderInput />
                    Move to project…
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => void copyLink()}>
                  <Link2 />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Delete document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <article className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pt-12 pb-24 md:px-12">
        <DocumentIconPicker
          value={document.icon}
          onChange={icon => void saveField({ icon })}
          trigger={
            <button
              type="button"
              aria-label={document.icon ? 'Change icon' : 'Add icon'}
              className="mb-3 flex w-fit items-center gap-1.5 rounded-md p-1 text-mini text-text-tertiary hover:bg-surface-hover hover:text-text-secondary"
            >
              {document.icon ? (
                <DocumentIcon icon={document.icon} size={36} />
              ) : (
                <>
                  <SmilePlus className="size-4" aria-hidden />
                  Add icon
                </>
              )}
            </button>
          }
        />
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          onBlur={() => titleSave.flush()}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              titleSave.flush()
              const editorElement = event.currentTarget
                .closest('article')
                ?.querySelector<HTMLElement>('[contenteditable="true"]')
              editorElement?.focus()
            }
          }}
          placeholder="Untitled"
          aria-label="Document title"
          maxLength={255}
          className="w-full bg-transparent text-[28px] leading-tight font-semibold text-foreground outline-none placeholder:text-text-tertiary"
        />
        <RichTextEditor
          value={content}
          onChange={setContent}
          onBlur={() => contentSave.flush()}
          placeholder="Write something, or press '/' for commands…"
          ariaLabel="Document content"
          className="mt-4 min-h-64 flex-1"
          renderIssueHref={identifier => path(`/issue/${identifier}`)}
          onIssueClick={(identifier, event) => {
            event.preventDefault()
            void navigate({ to: path(`/issue/${identifier}`) as '/' })
          }}
        />
      </article>

      <DeleteDocumentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={shownTitle}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
