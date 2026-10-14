import { useEffect, useMemo } from 'react'
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { CircleDot, LogOut, Plus, Search, Settings, SquarePen, Users } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { ShortcutsProvider } from '@/components/command'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { ProjectIcon } from '@/components/ProjectIcon'
import { DocumentIcon } from '@/components/documents/DocumentIcon'
import { CreateIssueHost } from '@/components/issues/CreateIssueHost'
import { SettingsSidebar } from '@/components/SettingsSidebar'
import { Sidebar, type SidebarLink } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserAvatar } from '@/components/UserAvatar'
import { WorkspaceCommands } from '@/components/WorkspaceCommands'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { Button, buttonVariants } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadNotificationCount } from '@/hooks/useNotifications'
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/WorkspaceContext'
import { settingsSections } from '@/features/workspaces/settings-nav'
import type { Favorite } from '@/types/favorite'
import { favoritePath, useFavorites, useReorderFavorite } from '@/hooks/useFavorites'
import {
  useLabels,
  useMe,
  useMembers,
  useMyTeams,
  useTeams,
  useWorkspaceByKey,
  useWorkspaces,
} from '@/hooks/useWorkspace'
import { openCreateIssueHere } from '@/lib/issue-events'
import { setLastWorkspaceId } from '@/lib/last-workspace'

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
  const myTeamsQuery = useMyTeams(workspace?.id)
  const membersQuery = useMembers(workspace?.id)
  const labelsQuery = useLabels(workspace?.id)
  const meQuery = useMe()
  const favoritesQuery = useFavorites(workspace?.id)
  const reorderFavorite = useReorderFavorite(workspace?.id ?? '')
  const unreadCountQuery = useUnreadNotificationCount(workspace?.id)
  // /<ws>/settings/... swaps the app sidebar for the settings sidebar.
  const inSettings = useLocation({
    select: location => location.pathname.startsWith(`/${workspaceKey}/settings`),
  })

  // "/" reopens this workspace next time (sign-in, the logo).
  const workspaceId = workspace?.id
  useEffect(() => {
    if (workspaceId) setLastWorkspaceId(workspaceId)
  }, [workspaceId])

  const value = useMemo<WorkspaceContextValue | null>(() => {
    if (
      !workspace ||
      !teamsQuery.data ||
      !myTeamsQuery.data ||
      !membersQuery.data ||
      !labelsQuery.data ||
      !meQuery.data
    )
      return null
    // "Your teams" = the teams the user joined, as Linear: joining a team adds it
    // to the sidebar, leaving removes it. The full team list stays the source of
    // the team data, so a deleted or renamed team updates at once.
    const myTeamIds = new Set(myTeamsQuery.data.map(team => team.id))
    return {
      workspace,
      teams: teamsQuery.data,
      myTeams: teamsQuery.data.filter(team => myTeamIds.has(team.id)),
      members: membersQuery.data,
      labels: labelsQuery.data,
      me: meQuery.data,
      path: (subPath: string) => `/${workspace.url_key}${subPath}`,
    }
  }, [
    workspace,
    teamsQuery.data,
    myTeamsQuery.data,
    membersQuery.data,
    labelsQuery.data,
    meQuery.data,
  ])

  if (workspaceQuery.isError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <EmptyState
          title="Workspace not found"
          description="This workspace does not exist or you are not a member of it."
          action={
            <>
              <Link to="/" className={buttonVariants({ size: 'sm' })}>
                Go to my workspaces
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await logout()
                  navigate({ to: '/login' })
                }}
              >
                <LogOut />
                Log out
              </Button>
            </>
          }
        />
      </div>
    )
  }

  if (!value) {
    return <div className="h-dvh bg-sidebar" aria-busy="true" />
  }

  const base = `/${value.workspace.url_key}`
  const favorites = favoritesQuery.data ?? []
  const favoriteLinks: SidebarLink[] = favorites.map(favorite => ({
    label: favorite.name,
    to: favoritePath(base, favorite),
    icon: <FavoriteIcon favorite={favorite} />,
  }))
  const moveFavorite = (from: number, to: number) => {
    const rest = favorites.filter((_, i) => i !== from)
    const before = rest[to - 1]
    const after = rest[to]
    const sortOrder =
      before && after
        ? (before.sort_order + after.sort_order) / 2
        : before
          ? before.sort_order + 1
          : after
            ? after.sort_order - 1
            : 0
    reorderFavorite.mutate({ id: favorites[from].id, data: { sort_order: sortOrder } })
  }
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
          <DropdownMenuItem onSelect={() => navigate({ to: `${base}/settings` as '/' })}>
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate({ to: '/onboarding' })}>
            <Plus />
            Create or join workspace
          </DropdownMenuItem>
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
        <>
          <IconButton
            label="Search"
            shortcut="/"
            icon={<Search />}
            onClick={() => navigate({ to: `${base}/search` as '/' })}
          />
          <IconButton
            label="Compose issue"
            shortcut="C"
            icon={<SquarePen />}
            // Same as `C`: the open page's team, project, cycle or assignee.
            onClick={() => openCreateIssueHere()}
          />
        </>
      }
      inboxTo={`${base}/inbox`}
      inboxCount={unreadCountQuery.data?.count}
      myIssuesTo={`${base}/my-issues`}
      projectsTo={`${base}/projects`}
      documentsTo={`${base}/documents`}
      viewsTo={`${base}/views`}
      favorites={favoriteLinks}
      onFavoriteMove={moveFavorite}
      teams={value.myTeams.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
        color: team.color ?? undefined,
        issuesTo: `${base}/team/${team.key}/issues`,
        cyclesTo: `${base}/team/${team.key}/cycles`,
        projectsTo: `${base}/team/${team.key}/projects`,
        documentsTo: `${base}/team/${team.key}/documents`,
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
      <ShortcutsProvider>
        <AppShell
          menuBadge={unreadCountQuery.data?.count}
          sidebar={
            inSettings ? (
              <SettingsSidebar
                backTo={`${base}/my-issues`}
                sections={settingsSections(base, value.teams)}
              />
            ) : (
              sidebar
            )
          }
        >
          <Outlet />
        </AppShell>
        <WorkspaceCommands />
        <CreateIssueHost />
      </ShortcutsProvider>
    </WorkspaceContext.Provider>
  )
}

function FavoriteIcon({ favorite }: { favorite: Favorite }) {
  const style = favorite.color ? { color: favorite.color } : undefined
  switch (favorite.entity_type) {
    case 'issue':
      return <CircleDot />
    case 'project':
      return <ProjectIcon icon={favorite.icon} color={favorite.color} size={16} />
    case 'document':
      return <DocumentIcon icon={favorite.icon} />
    case 'team':
      return <Users style={style} />
  }
}
