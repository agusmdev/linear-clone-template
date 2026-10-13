import { useCallback, useMemo } from 'react'
import type { RenderIssueHref } from '@/components/editor'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'

/**
 * The issue link of an identifier in rich text (`ENG-12` -> `/<ws>/issue/ENG-12`).
 * Only the keys of the workspace's teams make links, so text such as `UTF-8` or
 * `ISO-9001` stays plain text instead of linking to a missing issue.
 */
export function useIssueHref(): RenderIssueHref {
  const { teams, path } = useCurrentWorkspace()
  const teamKeys = useMemo(() => new Set(teams.map(team => team.key.toUpperCase())), [teams])
  return useCallback(
    (identifier: string) => {
      const key = identifier.slice(0, identifier.lastIndexOf('-'))
      return teamKeys.has(key) ? path(`/issue/${identifier}`) : null
    },
    [teamKeys, path]
  )
}
