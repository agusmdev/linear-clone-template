import { createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '@/components/EmptyState'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import {
  ProjectsListPage,
  parseProjectsTab,
  type ProjectsTab,
} from '@/features/projects/ProjectsListPage'

/** Projects of one team (`team_id` filter), with status tabs (`?status=`). */
export const Route = createFileRoute('/_authed/$workspaceKey/team/$teamKey/projects')({
  validateSearch: (search: Record<string, unknown>): { status?: ProjectsTab } => {
    const tab = parseProjectsTab(search.status)
    return tab === 'all' ? {} : { status: tab }
  },
  component: TeamProjectsPage,
})

function TeamProjectsPage() {
  const { teamKey } = Route.useParams()
  const { status } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { teams, path } = useCurrentWorkspace()
  const team = teams.find(t => t.key.toLowerCase() === teamKey.toLowerCase())

  if (!team) {
    return (
      <EmptyState
        title="Team not found"
        description={`There is no team with the key ${teamKey} in this workspace.`}
      />
    )
  }

  return (
    <ProjectsListPage
      key={team.id}
      teamId={team.id}
      breadcrumbs={[{ label: team.name, to: path(`/team/${team.key}/issues`) }]}
      title="Projects"
      tab={status ?? 'all'}
      onTabChange={tab => navigate({ search: tab === 'all' ? {} : { status: tab } })}
    />
  )
}
