import { createFileRoute } from '@tanstack/react-router'
import {
  ProjectsListPage,
  parseProjectsTab,
  type ProjectsTab,
} from '@/features/projects/ProjectsListPage'

/** All projects of the workspace, with status tabs (`?status=`). */
export const Route = createFileRoute('/_authed/$workspaceKey/projects')({
  validateSearch: (search: Record<string, unknown>): { status?: ProjectsTab } => {
    const tab = parseProjectsTab(search.status)
    return tab === 'all' ? {} : { status: tab }
  },
  component: WorkspaceProjectsPage,
})

function WorkspaceProjectsPage() {
  const { status } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ProjectsListPage
      title="Projects"
      tab={status ?? 'all'}
      onTabChange={tab => navigate({ search: tab === 'all' ? {} : { status: tab } })}
    />
  )
}
