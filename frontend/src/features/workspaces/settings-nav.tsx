import { Building2, CircleUser, Tag, Users, UsersRound } from 'lucide-react'
import type { SettingsNavSection } from '@/components/SettingsSidebar'
import type { Team } from '@/types/team'

/** A small square with the team key on the team color (settings nav, team lists). */
export function TeamBadge({
  team,
  size = 18,
}: {
  team: Pick<Team, 'key' | 'color'>
  size?: number
}) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold text-white"
      style={{ width: size, height: size, backgroundColor: team.color ?? 'var(--primary)' }}
    >
      {team.key.slice(0, 2)}
    </span>
  )
}

/** The groups of the settings sidebar for workspace `base` (`/acme`). */
export function settingsSections(base: string, teams: Team[]): SettingsNavSection[] {
  return [
    {
      title: 'Account',
      items: [
        { label: 'Profile & preferences', to: `${base}/settings/account`, icon: <CircleUser /> },
      ],
    },
    {
      title: 'Administration',
      items: [
        { label: 'Workspace', to: `${base}/settings`, icon: <Building2 />, exact: true },
        { label: 'Members', to: `${base}/settings/members`, icon: <Users /> },
        { label: 'Labels', to: `${base}/settings/labels`, icon: <Tag /> },
        { label: 'Teams', to: `${base}/settings/teams`, icon: <UsersRound />, exact: true },
      ],
    },
    {
      title: 'Teams',
      items: teams.map(team => ({
        label: team.name,
        to: `${base}/settings/team/${team.key}`,
        icon: <TeamBadge team={team} size={16} />,
      })),
    },
  ]
}
