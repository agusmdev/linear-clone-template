import { createFileRoute } from '@tanstack/react-router'
import { Bell, CircleUserRound, PenLine, SquarePen } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { IssuesView } from '@/components/issues/IssuesView'
import { useSearchTab, ViewTabs, type ViewTab } from '@/components/issues/ViewTabs'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import type { FilterKind } from '@/features/issues/view-state'
import { openCreateIssue } from '@/lib/issue-events'
import type { IssuesParams } from '@/types/issue'

/** My issues (ISS-13): Assigned / Created / Subscribed tabs over the shared IssuesView. */
export const Route = createFileRoute('/_authed/$workspaceKey/my-issues')({
  component: MyIssuesPage,
})

type MyTab = 'assigned' | 'created' | 'subscribed'

const TABS: ViewTab<MyTab>[] = [
  { value: 'assigned', label: 'Assigned', icon: <CircleUserRound /> },
  { value: 'created', label: 'Created', icon: <PenLine /> },
  { value: 'subscribed', label: 'Subscribed', icon: <Bell /> },
]

const TAB_PARAMS: Record<MyTab, Partial<IssuesParams>> = {
  assigned: { assignee_id: 'me' },
  created: { creator_id: 'me' },
  subscribed: { subscriber_id: 'me' },
}

const HIDDEN_FILTERS: Record<MyTab, FilterKind[]> = {
  assigned: ['assignee'],
  created: ['creator'],
  subscribed: [],
}

const EMPTY_TEXT: Record<MyTab, string> = {
  assigned: 'Issues assigned to you show up here.',
  created: 'Issues you create show up here.',
  subscribed: 'Issues you subscribe to show up here.',
}

function MyIssuesPage() {
  const ws = useCurrentWorkspace()
  const [tab, setTab] = useSearchTab(TABS)
  const params: IssuesParams = { workspace_id: ws.workspace.id, ...TAB_PARAMS[tab] }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="My issues"
        actions={
          <IconButton
            label="New issue"
            shortcut="C"
            icon={<SquarePen />}
            onClick={() => openCreateIssue(tab === 'assigned' ? { assigneeId: ws.me.id } : {})}
          />
        }
      >
        <ViewTabs label="My issue views" tabs={TABS} value={tab} onChange={setTab} />
      </PageHeader>
      <IssuesView
        key={tab}
        params={params}
        hiddenFilters={HIDDEN_FILTERS[tab]}
        createDefaults={tab === 'assigned' ? { assigneeId: ws.me.id } : {}}
        emptyState={
          <EmptyState
            icon={<CircleUserRound />}
            title="No issues"
            description={EMPTY_TEXT[tab]}
            action={
              <Button
                size="sm"
                onClick={() => openCreateIssue(tab === 'assigned' ? { assigneeId: ws.me.id } : {})}
              >
                Create issue
              </Button>
            }
          />
        }
      />
    </div>
  )
}
