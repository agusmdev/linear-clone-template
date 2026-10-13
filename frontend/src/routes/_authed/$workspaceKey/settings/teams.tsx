import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { CreateTeamDialog } from '@/components/CreateTeamDialog'
import { PageHeader } from '@/components/PageHeader'
import { SettingsCard, SettingsPage, SettingsSection } from '@/components/SettingsPage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import {
  useAddTeamMember,
  useCreateTeam,
  useMembersOfTeams,
  useRemoveTeamMember,
} from '@/hooks/useWorkspaceSettings'
import { toastApiError } from '@/lib/error-handler'
import { TeamBadge } from '@/features/workspaces/settings-nav'
import type { TeamFormData } from '@/features/workspaces/workspace-schemas'
import type { Team } from '@/types/team'

/** Settings › Teams (WS-4): all teams, join / leave, create a team. */
export const Route = createFileRoute('/_authed/$workspaceKey/settings/teams')({
  component: TeamsSettings,
})

function TeamsSettings() {
  const { workspace, teams, me, path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const createTeam = useCreateTeam(workspace.id)
  const membersByTeam = useMembersOfTeams(teams.map(team => team.id))
  const [creating, setCreating] = useState(false)

  const onCreate = async (data: TeamFormData) => {
    const team = await createTeam.mutateAsync({
      name: data.name.trim(),
      key: data.key,
      color: data.color,
    })
    setCreating(false)
    toast.success(`Team ${team.name} created`)
    navigate({ to: path(`/settings/team/${team.key}`) as '/' })
  }

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Settings' }]} title="Teams" />
      <SettingsPage
        title="Teams"
        description="Teams own issues, workflows and cycles. Join the teams you work with."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus />
            Create team
          </Button>
        }
      >
        <SettingsSection title={`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}>
          <SettingsCard role="list" aria-label="Teams">
            {teams.map(team => {
              const members = membersByTeam.get(team.id)
              const joined = members?.some(member => member.user_id === me.id) ?? false
              return (
                <TeamRow
                  key={team.id}
                  team={team}
                  to={path(`/settings/team/${team.key}`)}
                  memberCount={members?.length}
                  joined={joined}
                />
              )
            })}
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>
      <CreateTeamDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={onCreate}
        pending={createTeam.isPending}
      />
    </>
  )
}

interface TeamRowProps {
  team: Team
  to: string
  memberCount?: number
  joined: boolean
}

function TeamRow({ team, to, memberCount, joined }: TeamRowProps) {
  const join = useAddTeamMember(team.id)
  const leave = useRemoveTeamMember(team.id)
  const pending = join.isPending || leave.isPending

  const toggle = async () => {
    try {
      if (joined) {
        await leave.mutateAsync('me')
        toast.success(`You left ${team.name}`)
      } else {
        await join.mutateAsync(undefined)
        toast.success(`You joined ${team.name}`)
      }
    } catch (error) {
      toastApiError(error, joined ? 'Could not leave the team' : 'Could not join the team')
    }
  }

  return (
    <div role="listitem" aria-label={team.name} className="flex h-14 items-center gap-3 px-4">
      <TeamBadge team={team} size={24} />
      <Link to={to as '/'} className="group flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-ui font-medium text-foreground group-hover:underline">
          {team.name}
        </span>
        <span className="font-mono text-mini text-text-tertiary">{team.key}</span>
      </Link>
      {memberCount !== undefined ? (
        <span className="text-mini text-text-secondary">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>
      ) : null}
      {joined ? <Badge variant="secondary">Joined</Badge> : null}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void toggle()}
        aria-label={joined ? `Leave ${team.name}` : `Join ${team.name}`}
      >
        {joined ? 'Leave' : 'Join'}
      </Button>
      <Link
        to={to as '/'}
        aria-label={`${team.name} settings`}
        className="flex size-6 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-hover hover:text-foreground"
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  )
}
