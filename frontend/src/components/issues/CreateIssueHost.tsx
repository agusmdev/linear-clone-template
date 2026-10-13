import { useEffect, useRef, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useIssue } from '@/hooks/useIssueDetail'
import { useCycleRefs, useProjectRefs } from '@/hooks/useIssueRefs'
import { useCreateIssue, useIssuesPage, useWorkspaceStates } from '@/hooks/useIssues'
import { clearIssueDraft, readIssueDraft, saveIssueDraft } from '@/features/issues/issue-draft'
import type { CreateIssueFormData } from '@/features/issues/issue-schemas'
import { ApiError } from '@/lib/api-client'
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
  const [session, setSession] = useState<{
    id: number
    detail: CreateIssueEventDetail
    /** The workspace's saved draft when the modal opened. */
    draft: CreateIssueFormData | null
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [teamId, setTeamId] = useState<string | undefined>()
  const [parentSearch, setParentSearch] = useState('')
  const debouncedParentSearch = useDebounce(parentSearch.trim(), 200)

  const urlTeamKey = /\/team\/([^/]+)/.exec(pathname)?.[1]
  const urlTeam = ws.teams.find(t => t.key.toLowerCase() === urlTeamKey?.toLowerCase())

  // A create request while the modal is open (e.g. "Create new issue" in the
  // command menu) keeps that modal: a new session would drop what is typed.
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  const workspaceId = ws.workspace.id
  useEffect(() => {
    const show = (detail: CreateIssueEventDetail) => {
      if (openRef.current) return
      const draft = readIssueDraft(workspaceId)
      setSession(prev => ({ id: (prev?.id ?? 0) + 1, detail, draft }))
      setTeamId(undefined)
      setParentSearch('')
      openRef.current = true
      setOpen(true)
    }
    const onEvent = (event: Event) =>
      show((event as CustomEvent<CreateIssueEventDetail>).detail ?? {})
    window.addEventListener(CREATE_ISSUE_EVENT, onEvent)
    return () => {
      window.removeEventListener(CREATE_ISSUE_EVENT, onEvent)
    }
  }, [workspaceId])

  // A draft of a deleted team is not restored.
  const draft =
    session?.draft && ws.teams.some(t => t.id === session.draft?.team_id)
      ? {
          ...session.draft,
          label_ids: session.draft.label_ids.filter(id => ws.labels.some(l => l.id === id)),
        }
      : null
  const defaultTeamId =
    draft?.team_id ??
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
  const defaultParentId = draft?.parent_id ?? session?.detail.parentId ?? null
  const defaultParent = useIssue(open ? defaultParentId : null)
  // A draft's parent deleted since: the create must leave it out (the chip shows none).
  const missingParentId =
    defaultParent.error instanceof ApiError && defaultParent.error.status === 404
      ? (defaultParentId ?? undefined)
      : undefined
  const create = useCreateIssue()

  const onCreate = async (data: CreateIssueData) => {
    try {
      const issue = await create.mutateAsync(data)
      clearIssueDraft(workspaceId)
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
      draft={draft}
      onSaveDraft={values => saveIssueDraft(workspaceId, values)}
      onDiscardDraft={() => clearIssueDraft(workspaceId)}
      teams={ws.teams}
      states={states}
      members={ws.members}
      labels={ws.labels}
      projects={projects}
      cycles={cycles}
      meId={ws.me.id}
      parentCandidates={parents.data?.items ?? []}
      defaultParent={defaultParent.data}
      missingParentId={missingParentId}
      onParentSearchChange={setParentSearch}
      onTeamChange={setTeamId}
      onCreate={onCreate}
      pending={create.isPending}
    />
  )
}
