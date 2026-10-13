import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Box, FileText, ListTodo, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteProjectDialog } from '@/components/DeleteProjectDialog'
import { DocumentList } from '@/components/documents/DocumentList'
import { EmptyState } from '@/components/EmptyState'
import { FavoriteButton } from '@/components/FavoriteButton'
import { IconButton } from '@/components/IconButton'
import { IssuesView } from '@/components/issues/IssuesView'
import { PageHeader } from '@/components/PageHeader'
import { ProgressRing } from '@/components/ProgressRing'
import { ProjectIcon, ProjectIconPicker } from '@/components/ProjectIcon'
import {
  ProjectDatePicker,
  ProjectLeadPicker,
  ProjectStatusPicker,
  ProjectTeamsPicker,
} from '@/components/ProjectPropertyPickers'
import { RichTextEditor, useDebouncedAutosave } from '@/components/editor'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useNewDocument } from '@/features/documents/useNewDocument'
import { useDeleteProject, useProject, useUpdateProject } from '@/hooks/useProjects'
import { toastApiError } from '@/lib/error-handler'
import { openCreateIssue } from '@/lib/issue-events'
import { cn } from '@/lib/utils'
import type { IssuesParams } from '@/types/issue'
import type { Project, UpdateProjectData } from '@/types/project'

type ProjectTab = 'overview' | 'issues' | 'documents'

const TABS: { value: ProjectTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'issues', label: 'Issues' },
  { value: 'documents', label: 'Documents' },
]

/**
 * A project (PRJ-3, DOC-6): header, Overview (properties, progress,
 * description), Issues (the shared IssuesView) and Documents tabs (`?tab=`).
 * Other search params (the IssuesView display options) pass through.
 */
export const Route = createFileRoute('/_authed/$workspaceKey/project/$projectId')({
  validateSearch: (
    search: Record<string, unknown>
  ): Record<string, unknown> & { tab?: ProjectTab } => {
    const { tab, ...rest } = search
    return tab === 'issues' || tab === 'documents' ? { ...rest, tab } : rest
  },
  component: ProjectPage,
})

function ProjectPage() {
  const { projectId } = Route.useParams()
  const { tab = 'overview' } = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const navigate = useNavigate()
  const { path } = useCurrentWorkspace()
  const projectQuery = useProject(projectId)
  const deleteProject = useDeleteProject()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const newDocument = useNewDocument({ project_id: projectId })
  const project = projectQuery.data

  if (projectQuery.isError) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader
          breadcrumbs={[{ label: 'Projects', to: path('/projects') }]}
          title="Not found"
        />
        <EmptyState
          icon={<Box />}
          title="Project not found"
          description="This project does not exist or was deleted."
        />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex min-h-full flex-col" aria-busy="true">
        <PageHeader breadcrumbs={[{ label: 'Projects', to: path('/projects') }]} title="" />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-10">
          <Skeleton className="size-9" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    )
  }

  // Switching tabs drops the IssuesView display options of the Issues tab.
  const setTab = (next: ProjectTab) =>
    routeNavigate({ search: next === 'overview' ? {} : { tab: next } })

  const newIssue = () => openCreateIssue({ projectId: project.id, teamId: project.team_ids[0] })

  return (
    <div className={cn('flex flex-col', tab === 'issues' ? 'h-full' : 'min-h-full')}>
      <PageHeader
        breadcrumbs={[{ label: 'Projects', to: path('/projects') }]}
        icon={<ProjectIcon icon={project.icon} color={project.color} />}
        title={project.name}
        actions={
          <>
            <FavoriteButton entityType="project" entityId={project.id} />
            {tab === 'issues' ? (
              <Button size="sm" variant="outline" onClick={newIssue}>
                <Plus />
                New issue
              </Button>
            ) : null}
            {tab === 'documents' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void newDocument.createAndOpen()}
                disabled={newDocument.isPending}
              >
                <Plus />
                New document
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Project options" icon={<MoreHorizontal />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <div role="tablist" aria-label="Project views" className="flex items-center gap-1">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-mini font-medium text-text-secondary hover:text-foreground',
                tab === value && 'border-border bg-surface-active text-foreground'
              )}
            >
              {label}
              {value === 'issues' ? (
                <span className="text-micro text-text-tertiary tabular-nums">
                  {project.issue_count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </PageHeader>

      {tab === 'overview' ? (
        <ProjectOverview key={project.id} project={project} />
      ) : tab === 'issues' ? (
        <ProjectIssues project={project} onNewIssue={newIssue} />
      ) : (
        <ProjectDocuments
          project={project}
          onNewDocument={() => void newDocument.createAndOpen()}
        />
      )}

      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectName={project.name}
        isPending={deleteProject.isPending}
        onConfirm={() =>
          deleteProject.mutate(project.id, {
            onSuccess: () => {
              setDeleteOpen(false)
              toast.success('Project deleted')
              navigate({ to: path('/projects') as '/' })
            },
            onError: error => toastApiError(error, 'Could not delete project'),
          })
        }
      />
    </div>
  )
}

function ProjectOverview({ project }: { project: Project }) {
  const { teams, members } = useCurrentWorkspace()
  const updateProject = useUpdateProject(project.id)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')

  const update = (data: UpdateProjectData) =>
    updateProject.mutate(data, {
      onError: error => toastApiError(error, 'Could not update project'),
    })

  const autosave = useDebouncedAutosave(description, next =>
    updateProject.mutateAsync({ description: next || null })
  )

  const saveName = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(project.name)
      return
    }
    if (trimmed !== project.name) update({ name: trimmed })
  }

  const { total, completed, percentage } = project.progress

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10">
      <ProjectIconPicker
        icon={project.icon}
        color={project.color}
        size={20}
        className="size-10"
        onChange={value => update(value)}
      />
      <input
        aria-label="Project name"
        value={name}
        placeholder="Project name"
        onChange={event => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setName(project.name)
            event.currentTarget.blur()
          }
        }}
        className="w-full bg-transparent text-title font-semibold text-foreground outline-none placeholder:text-text-tertiary"
      />

      <section aria-label="Properties" className="flex flex-wrap items-center gap-1.5">
        <ProjectStatusPicker value={project.status} onChange={status => update({ status })} />
        <ProjectLeadPicker
          members={members}
          value={project.lead_id}
          onChange={leadId => update({ lead_id: leadId })}
        />
        <ProjectDatePicker
          label="Start date"
          value={project.start_date}
          max={project.target_date}
          onChange={date => update({ start_date: date })}
        />
        <ProjectDatePicker
          label="Target date"
          value={project.target_date}
          min={project.start_date}
          onChange={date => update({ target_date: date })}
        />
        <ProjectTeamsPicker
          teams={teams}
          value={project.team_ids}
          onChange={teamIds => update({ team_ids: teamIds })}
        />
      </section>

      <section
        aria-label="Progress"
        className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-hover/30 p-4"
      >
        <div className="flex items-center gap-2 text-ui font-medium">
          <ProgressRing percentage={percentage} size={16} />
          Progress
          <span className="ml-auto text-mini text-text-secondary tabular-nums">{percentage}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-active">
          <div
            className="h-full rounded-full bg-status-completed transition-[width]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-mini text-text-secondary">
          {total === 0
            ? 'No issues in this project yet.'
            : `${completed} of ${total} issues completed`}
        </p>
      </section>

      <section aria-label="Description" className="flex flex-col gap-1">
        <div className="flex h-5 items-center justify-between">
          <h2 className="text-mini font-medium text-text-secondary">Description</h2>
          <span aria-live="polite" className="text-micro text-text-tertiary">
            {autosave.status === 'saving'
              ? 'Saving…'
              : autosave.status === 'saved'
                ? 'Saved'
                : autosave.status === 'error'
                  ? 'Not saved'
                  : ''}
          </span>
        </div>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          onBlur={() => autosave.flush()}
          placeholder="Add description…"
          ariaLabel="Project description"
          className="min-h-40"
        />
      </section>
    </div>
  )
}

function ProjectIssues({ project, onNewIssue }: { project: Project; onNewIssue: () => void }) {
  const { workspace } = useCurrentWorkspace()
  const params = useMemo<IssuesParams>(
    () => ({ workspace_id: workspace.id, project_id: project.id }),
    [workspace.id, project.id]
  )
  return (
    <IssuesView
      params={params}
      createDefaults={{ projectId: project.id, teamId: project.team_ids[0] }}
      hiddenFilters={['project']}
      emptyState={
        <EmptyState
          icon={<ListTodo />}
          title="No issues in this project"
          description="Issues added to the project show up here."
          action={
            <Button size="sm" onClick={onNewIssue}>
              <Plus />
              New issue
            </Button>
          }
        />
      }
    />
  )
}

function ProjectDocuments({
  project,
  onNewDocument,
}: {
  project: Project
  onNewDocument: () => void
}) {
  return (
    <DocumentList
      params={{ project_id: project.id }}
      emptyState={
        <EmptyState
          icon={<FileText />}
          title="No documents in this project"
          description="Write specs, notes and plans next to the project's issues."
          action={
            <Button size="sm" onClick={onNewDocument}>
              <Plus />
              New document
            </Button>
          }
        />
      }
    />
  )
}
