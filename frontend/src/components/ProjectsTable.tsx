import { Link, useNavigate } from '@tanstack/react-router'
import { ProgressRing } from '@/components/ProgressRing'
import { ProjectIcon } from '@/components/ProjectIcon'
import { formatProjectDate } from '@/components/ProjectPropertyPickers'
import { ProjectStatusIcon, PROJECT_STATUS_LABELS } from '@/components/ProjectStatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { Project } from '@/types/project'

interface ProjectsTableProps {
  projects: Project[]
  /** In-app path of a project page. */
  projectHref: (projectId: string) => string
}

const headClass = 'h-8 px-2 text-left text-mini font-normal text-text-tertiary'
const cellClass = 'h-11 px-2 text-ui'

/** Linear's project list: name, status, lead, target date, progress, teams. */
export function ProjectsTable({ projects, projectHref }: ProjectsTableProps) {
  const navigate = useNavigate()
  return (
    <table className="w-full table-fixed border-collapse">
      <thead className="border-b border-border-subtle">
        <tr>
          <th scope="col" className={`${headClass} w-auto pl-6`}>
            Name
          </th>
          <th scope="col" className={`${headClass} w-36`}>
            Status
          </th>
          <th scope="col" className={`${headClass} hidden w-16 md:table-cell`}>
            Lead
          </th>
          <th scope="col" className={`${headClass} hidden w-28 md:table-cell`}>
            Target date
          </th>
          <th scope="col" className={`${headClass} w-24`}>
            Progress
          </th>
          <th scope="col" className={`${headClass} hidden w-40 pr-6 lg:table-cell`}>
            Teams
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map(project => {
          const href = projectHref(project.id)
          return (
            <tr
              key={project.id}
              data-testid="project-row"
              onClick={event => {
                if ((event.target as HTMLElement).closest('a')) return
                navigate({ to: href as '/' })
              }}
              className="cursor-pointer border-b border-border-subtle hover:bg-surface-hover"
            >
              <td className={`${cellClass} pl-6`}>
                <Link
                  to={href as '/'}
                  className="flex min-w-0 items-center gap-2.5 font-medium text-foreground outline-none focus-visible:underline"
                >
                  <ProjectIcon icon={project.icon} color={project.color} />
                  <span className="truncate">{project.name}</span>
                </Link>
              </td>
              <td className={cellClass}>
                <span className="flex items-center gap-1.5 text-mini text-text-secondary">
                  <ProjectStatusIcon status={project.status} />
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </td>
              <td className={`${cellClass} hidden md:table-cell`}>
                {project.lead ? (
                  <UserAvatar name={project.lead.name || project.lead.email} size="sm" />
                ) : (
                  <UserAvatar name={null} size="sm" />
                )}
              </td>
              <td className={`${cellClass} hidden text-mini text-text-secondary md:table-cell`}>
                {formatProjectDate(project.target_date) ?? (
                  <span className="text-text-tertiary">—</span>
                )}
              </td>
              <td className={cellClass}>
                <span className="flex items-center gap-1.5 text-mini text-text-secondary tabular-nums">
                  <ProgressRing percentage={project.progress.percentage} />
                  {project.progress.percentage}%
                </span>
              </td>
              <td className={`${cellClass} hidden pr-6 lg:table-cell`}>
                <span className="block truncate text-mini text-text-secondary">
                  {project.teams.map(t => t.name).join(', ') || (
                    <span className="text-text-tertiary">—</span>
                  )}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Loading rows with the height of the real ones. */
export function ProjectsTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-3 border-b border-border-subtle px-6">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  )
}
