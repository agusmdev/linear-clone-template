import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Box, Plus } from 'lucide-react'
import { CreateProjectDialog } from '@/components/CreateProjectDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader, type Breadcrumb } from '@/components/PageHeader'
import { ProjectsTable, ProjectsTableSkeleton } from '@/components/ProjectsTable'
import {
  ProjectStatusIcon,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
} from '@/components/ProjectStatusIcon'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useProjects } from '@/hooks/useProjects'
import { getErrorMessage } from '@/lib/error-handler'
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/types/project'

export type ProjectsTab = ProjectStatus | 'all'

const TABS: ProjectsTab[] = ['all', ...PROJECT_STATUS_ORDER]

/** `?status=` of the projects pages: a project status, else "all". */
export function parseProjectsTab(value: unknown): ProjectsTab {
  return TABS.includes(value as ProjectsTab) ? (value as ProjectsTab) : 'all'
}

interface ProjectsListPageProps {
  /** Set on the team projects page: only projects of this team. */
  teamId?: string
  breadcrumbs?: Breadcrumb[]
  title: string
  tab: ProjectsTab
  onTabChange: (tab: ProjectsTab) => void
}

/**
 * Body of /$ws/projects and /$ws/team/$teamKey/projects: header with status
 * tabs (with counts) and "New project", the projects table, empty states.
 */
export function ProjectsListPage({
  teamId,
  breadcrumbs,
  title,
  tab,
  onTabChange,
}: ProjectsListPageProps) {
  const { workspace, teams, members, path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const projectsQuery = useProjects(workspace.id, teamId ? { team_id: teamId } : undefined)
  const projects = projectsQuery.data ?? []
  const shown = tab === 'all' ? projects : projects.filter(p => p.status === tab)
  const countOf = (value: ProjectsTab) =>
    value === 'all' ? projects.length : projects.filter(p => p.status === value).length
  const projectHref = (id: string) => path(`/project/${id}`)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            New project
          </Button>
        }
      >
        <div
          role="tablist"
          aria-label="Project status"
          className="flex flex-wrap items-center gap-1"
        >
          {TABS.map(value => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => onTabChange(value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-mini font-medium text-text-secondary hover:text-foreground',
                tab === value && 'border-border bg-surface-active text-foreground'
              )}
            >
              {value === 'all' ? null : <ProjectStatusIcon status={value} size={12} />}
              {value === 'all' ? 'All projects' : PROJECT_STATUS_LABELS[value]}
              <span className="text-micro text-text-tertiary tabular-nums">{countOf(value)}</span>
            </button>
          ))}
        </div>
      </PageHeader>

      {projectsQuery.isPending ? (
        <ProjectsTableSkeleton />
      ) : projectsQuery.isError ? (
        <EmptyState
          title="Could not load projects"
          description={getErrorMessage(projectsQuery.error)}
          action={
            <Button size="sm" variant="outline" onClick={() => projectsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Box />}
          title={projects.length === 0 ? 'No projects yet' : 'No projects with this status'}
          description={
            projects.length === 0
              ? 'Projects group issues toward a goal, with a lead, dates and progress.'
              : undefined
          }
          action={
            projects.length === 0 ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus />
                Create project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ProjectsTable projects={shown} projectHref={projectHref} />
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspace.id}
        teams={teams}
        members={members}
        defaultTeamId={teamId}
        onCreated={project => navigate({ to: projectHref(project.id) as '/' })}
      />
    </div>
  )
}
