import { useMemo } from 'react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { LogOut, SquarePen } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { CreateIssueHost } from '@/components/issues/CreateIssueHost'
import { Sidebar } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserAvatar } from '@/components/UserAvatar'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadNotificationCount } from '@/hooks/useNotifications'
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/WorkspaceContext'
import {
  useLabels,
  useMe,
  useMembers,
  useTeams,
  useWorkspaceByKey,
  useWorkspaces,
} from '@/hooks/useWorkspace'
import { openCreateIssue } from '@/lib/issue-events'

/**
 * Layout of every workspace page: `/$workspaceKey/...`.
 * Loads the workspace (404 = not a member), its teams, members, labels and the
 * user, provides them through WorkspaceContext and renders the Linear app
 * shell (sidebar + main panel). Child pages render their own <PageHeader />.
 */
export const Route = createFileRoute('/_authed/$workspaceKey')({
  staticData: { appShell: true },
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { workspaceKey } = Route.useParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const workspaceQuery = useWorkspaceByKey(workspaceKey)
  const workspace = workspaceQuery.data
  const workspacesQuery = useWorkspaces()
  const teamsQuery = useTeams(workspace?.id)
  const membersQuery = useMembers(workspace?.id)
  const labelsQuery = useLabels(workspace?.id)
  const meQuery = useMe()
  const unreadCountQuery = useUnreadNotificationCount(workspace?.id)

  const value = useMemo<WorkspaceContextValue | null>(() => {
    if (!workspace || !teamsQuery.data || !membersQuery.data || !labelsQuery.data || !meQuery.data)
      return null
    return {
      workspace,
      teams: teamsQuery.data,
      members: membersQuery.data,
      labels: labelsQuery.data,
      me: meQuery.data,
      path: (subPath: string) => `/${workspace.url_key}${subPath}`,
    }
  }, [workspace, teamsQuery.data, membersQuery.data, labelsQuery.data, meQuery.data])

  if (workspaceQuery.isError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <EmptyState
          title="Workspace not found"
          description="This workspace does not exist or you are not a member of it."
        />
      </div>
    )
  }

  if (!value) {
    return <div className="h-dvh bg-sidebar" aria-busy="true" />
  }

  const base = `/${value.workspace.url_key}`
  const sidebar = (
    <Sidebar
      workspaceSwitcher={
        <WorkspaceSwitcher
          current={value.workspace}
          workspaces={workspacesQuery.data ?? [value.workspace]}
          userEmail={value.me.email}
          onSelect={ws => {
            const target = workspacesQuery.data?.find(w => w.id === ws.id)
            if (target) navigate({ to: `/${target.url_key}/my-issues` as '/' })
          }}
        >
          <DropdownMenuItem
            onSelect={async () => {
              await logout()
              navigate({ to: '/login' })
            }}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </WorkspaceSwitcher>
      }
      actions={
        <IconButton
          label="New issue"
          shortcut="C"
          icon={<SquarePen />}
          onClick={() => openCreateIssue()}
        />
      }
      inboxTo={`${base}/inbox`}
      inboxCount={unreadCountQuery.data?.count}
      myIssuesTo={`${base}/my-issues`}
      projectsTo={`${base}/projects`}
      documentsTo={`${base}/documents`}
      viewsTo={`${base}/views`}
      teams={value.teams.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
        color: team.color ?? undefined,
        issuesTo: `${base}/team/${team.key}/issues`,
        cyclesTo: `${base}/team/${team.key}/cycles`,
        projectsTo: `${base}/team/${team.key}/projects`,
      }))}
      footer={
        <>
          <UserAvatar name={value.me.display_name || value.me.email} size="sm" />
          <span className="min-w-0 flex-1 truncate text-ui text-text-secondary">
            {value.me.display_name || value.me.email}
          </span>
          <ThemeToggle />
        </>
      }
    />
  )

  return (
    <WorkspaceContext.Provider value={value}>
      <AppShell sidebar={sidebar}>
        <Outlet />
      </AppShell>
      <CreateIssueHost />
    </WorkspaceContext.Provider>
  )
}
