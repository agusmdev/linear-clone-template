import { useEffect, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useIssue } from '@/hooks/useIssueDetail'
import { useCycleRefs, useProjectRefs } from '@/hooks/useIssueRefs'
import { useCreateIssue, useIssuesPage, useWorkspaceStates } from '@/hooks/useIssues'
import { toastApiError } from '@/lib/error-handler'
import { CREATE_ISSUE_EVENT } from '@/lib/issue-events'
import type { CreateIssueData, CreateIssueEventDetail } from '@/types/issue'
import { CreateIssueDialog } from './CreateIssueDialog'

/**
 * Mounted once in the workspace layout. Opens the create-issue modal on the
 * `linear:create-issue` window event (see `openCreateIssue`; the `C` shortcut of
 * WorkspaceCommands dispatches it).
 * The default team is the event's team, else the team of the current URL
 * (`/<ws>/team/<KEY>/...`), else the first team.
 */
export function CreateIssueHost() {
  const ws = useCurrentWorkspace()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: s => s.location.pathname })
  const [session, setSession] = useState<{ id: number; detail: CreateIssueEventDetail } | null>(
    null
  )
  const [open, setOpen] = useState(false)
  const [teamId, setTeamId] = useState<string | undefined>()
  const [parentSearch, setParentSearch] = useState('')
  const debouncedParentSearch = useDebounce(parentSearch.trim(), 200)

  const urlTeamKey = /\/team\/([^/]+)/.exec(pathname)?.[1]
  const urlTeam = ws.teams.find(t => t.key.toLowerCase() === urlTeamKey?.toLowerCase())

  useEffect(() => {
    const show = (detail: CreateIssueEventDetail) => {
      setSession(prev => ({ id: (prev?.id ?? 0) + 1, detail }))
      setTeamId(undefined)
      setParentSearch('')
      setOpen(true)
    }
    const onEvent = (event: Event) =>
      show((event as CustomEvent<CreateIssueEventDetail>).detail ?? {})
    window.addEventListener(CREATE_ISSUE_EVENT, onEvent)
    return () => {
      window.removeEventListener(CREATE_ISSUE_EVENT, onEvent)
    }
  }, [])

  const defaultTeamId =
    (session?.detail.teamId && ws.teams.some(t => t.id === session.detail.teamId)
      ? session.detail.teamId
      : undefined) ??
    urlTeam?.id ??
    ws.teams[0]?.id
  const activeTeamId = teamId ?? defaultTeamId

  const { data: states } = useWorkspaceStates(ws.teams)
  const projects = useProjectRefs(ws.workspace.id)
  const cycles = useCycleRefs(ws.teams.map(t => t.id))
  // The parent picker searches the server: a team can have more issues than one page.
  const parents = useIssuesPage(
    {
      workspace_id: ws.workspace.id,
      team_id: activeTeamId,
      search: debouncedParentSearch || undefined,
      order_by: ['-updated_at'],
      size: 100,
    },
    open && !!activeTeamId
  )
  const defaultParent = useIssue(open ? (session?.detail.parentId ?? null) : null)
  const create = useCreateIssue()

  const onCreate = async (data: CreateIssueData) => {
    try {
      const issue = await create.mutateAsync(data)
      toast.success(`Created ${issue.identifier}`, {
        description: issue.title,
        action: {
          label: 'View issue',
          onClick: () => void navigate({ to: ws.path(`/issue/${issue.identifier}`) as '/' }),
        },
      })
      return issue
    } catch (error) {
      toastApiError(error, 'Could not create issue')
      throw error
    }
  }

  if (!session || !defaultTeamId) return null
  return (
    <CreateIssueDialog
      key={session.id}
      open={open}
      onOpenChange={setOpen}
      defaults={{ ...session.detail, teamId: defaultTeamId }}
      teams={ws.teams}
      states={states}
      members={ws.members}
      labels={ws.labels}
      projects={projects}
      cycles={cycles}
      meId={ws.me.id}
      parentCandidates={parents.data?.items ?? []}
      defaultParent={defaultParent.data}
      onParentSearchChange={setParentSearch}
      onTeamChange={setTeamId}
      onCreate={onCreate}
      pending={create.isPending}
    />
  )
}
