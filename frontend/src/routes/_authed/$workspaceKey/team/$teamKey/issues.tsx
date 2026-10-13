import { createFileRoute } from '@tanstack/react-router'
import { CircleDashed, Copy, Layers, SquarePen } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { IssuesView } from '@/components/issues/IssuesView'
import { useSearchTab, ViewTabs, type ViewTab } from '@/components/issues/ViewTabs'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { usePageIssueDefaults } from '@/hooks/usePageIssueDefaults'
import { openCreateIssue } from '@/lib/issue-events'
import type { CreateIssueEventDetail, IssuesParams } from '@/types/issue'
import type { WorkflowStateType } from '@/types/team'

/** Team issues (ISS-13): All issues / Active / Backlog tabs over the shared IssuesView. */
export const Route = createFileRoute('/_authed/$workspaceKey/team/$teamKey/issues')({
  component: TeamIssuesPage,
})

type TeamTab = 'all' | 'active' | 'backlog'

const TABS: ViewTab<TeamTab>[] = [
  { value: 'all', label: 'All issues', icon: <Copy /> },
  { value: 'active', label: 'Active', icon: <Layers /> },
  { value: 'backlog', label: 'Backlog', icon: <CircleDashed /> },
]

const TAB_STATE_TYPES: Record<TeamTab, WorkflowStateType[] | undefined> = {
  all: undefined,
  active: ['unstarted', 'started'],
  backlog: ['backlog'],
}

function TeamIssuesPage() {
  const { teamKey } = Route.useParams()
  const ws = useCurrentWorkspace()
  const team = ws.teams.find(t => t.key.toLowerCase() === teamKey.toLowerCase())
  const [tab, setTab] = useSearchTab(TABS)
  // New issues land in the open tab: the Backlog tab creates them in the backlog.
  const createDefaults: CreateIssueEventDetail = team
    ? { teamId: team.id, stateType: tab === 'backlog' ? 'backlog' : undefined }
    : {}
  usePageIssueDefaults(createDefaults)

  if (!team) {
    return (
      <>
        <PageHeader title="Issues" />
        <EmptyState
          title="Team not found"
          description={`There is no team with the key ${teamKey} in this workspace.`}
        />
      </>
    )
  }

  const params: IssuesParams = {
    workspace_id: ws.workspace.id,
    team_id: team.id,
    state_type__in: TAB_STATE_TYPES[tab],
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumbs={[
          {
            label: team.name,
            icon: (
              <span className="flex size-4 items-center justify-center rounded bg-surface-active text-[9px] font-semibold text-foreground">
                {team.key.slice(0, 2)}
              </span>
            ),
          },
        ]}
        title="Issues"
        actions={
          <IconButton
            label="New issue"
            shortcut="C"
            icon={<SquarePen />}
            onClick={() => openCreateIssue(createDefaults)}
          />
        }
      >
        <ViewTabs label="Issue views" tabs={TABS} value={tab} onChange={setTab} />
      </PageHeader>
      <IssuesView
        key={`${team.id}-${tab}`}
        params={params}
        createDefaults={createDefaults}
        emptyState={
          <EmptyState
            icon={<Layers />}
            title={
              tab === 'backlog'
                ? 'No issues in the backlog'
                : tab === 'active'
                  ? 'No active issues'
                  : 'No issues yet'
            }
            description="Create an issue to plan and track the work of this team."
            action={
              <Button size="sm" onClick={() => openCreateIssue(createDefaults)}>
                Create issue
              </Button>
            }
          />
        }
      />
    </div>
  )
}
