import { createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '@/components/EmptyState'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { DocumentsListPage } from '@/features/documents/DocumentsListPage'

/** DOC-2: the documents of one team (`team_id` filter); "New document" makes one in the team. */
export const Route = createFileRoute('/_authed/$workspaceKey/team/$teamKey/documents')({
  component: TeamDocumentsPage,
})

function TeamDocumentsPage() {
  const { teamKey } = Route.useParams()
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
    <DocumentsListPage
      key={team.id}
      teamId={team.id}
      breadcrumbs={[{ label: team.name, to: path(`/team/${team.key}/issues`) }]}
    />
  )
}
