import { useMemo } from 'react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Box, CircleDot, FileText, LogOut, Search, SquarePen, Users } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { ShortcutsProvider } from '@/components/command'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { Sidebar, type SidebarLink } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserAvatar } from '@/components/UserAvatar'
import { WorkspaceCommands, openCreateIssue } from '@/components/WorkspaceCommands'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/WorkspaceContext'
import type { Favorite } from '@/types/favorite'
import { favoritePath, useFavorites, useReorderFavorite } from '@/hooks/useFavorites'
import {
  useLabels,
  useMe,
  useMembers,
  useTeams,
  useWorkspaceByKey,
  useWorkspaces,
} from '@/hooks/useWorkspace'

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
  const favoritesQuery = useFavorites(workspace?.id)
  const reorderFavorite = useReorderFavorite(workspace?.id ?? '')

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
            onClick={() => openCreateIssue()}
          />
        </>
      }
      inboxTo={`${base}/inbox`}
      myIssuesTo={`${base}/my-issues`}
      projectsTo={`${base}/projects`}
      documentsTo={`${base}/documents`}
      viewsTo={`${base}/views`}
      favorites={favoriteLinks}
      onFavoriteMove={moveFavorite}
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
      <ShortcutsProvider>
        <AppShell sidebar={sidebar}>
          <Outlet />
        </AppShell>
        <WorkspaceCommands />
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
      return <Box style={style} />
    case 'document':
      return <FileText />
    case 'team':
      return <Users style={style} />
  }
}
