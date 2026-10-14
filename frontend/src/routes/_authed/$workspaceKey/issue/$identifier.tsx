import * as React from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { createFileRoute, Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CornerLeftUp,
  Hash,
  Link as LinkIcon,
  MoreHorizontal,
  SearchX,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useShortcut } from '@/components/command'
import { DeleteIssueDialog } from '@/components/DeleteIssueDialog'
import { FavoriteButton } from '@/components/FavoriteButton'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { StatusIcon } from '@/components/StatusIcon'
import { UserAvatar } from '@/components/UserAvatar'
import { RichTextEditor, useDebouncedAutosave } from '@/components/editor'
import {
  cycleLabel,
  IssuePropertiesPanel,
  type PanelPicker,
} from '@/components/issue-detail/IssuePropertiesPanel'
import {
  CommentComposer,
  IssueTimeline,
  type IssueLinkClick,
} from '@/components/issue-detail/IssueTimeline'
import { IssueTitleInput } from '@/components/issue-detail/IssueTitleInput'
import { RelationsSection } from '@/components/issue-detail/RelationsSection'
import { SubIssuesSection } from '@/components/issue-detail/SubIssuesSection'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useTeamCycles } from '@/hooks/useCycles'
import { useProjects } from '@/hooks/useProjects'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useComments,
  useCreateComment,
  useCreateRelation,
  useCreateSubIssue,
  useDeleteComment,
  useDeleteIssueDetail,
  useDeleteRelation,
  useIssue,
  useIssueActivity,
  issueUpdateMutationKey,
  useIssueByIdentifier,
  useIssueSearch,
  useRelations,
  useSubIssues,
  useSubscribers,
  useToggleSubscription,
  useUpdateComment,
  useUpdateIssueDetail,
} from '@/hooks/useIssueDetail'
import { useIssueHref } from '@/hooks/useIssueHref'
import { useTeamStates } from '@/hooks/useWorkspace'
import { toastApiError } from '@/lib/error-handler'
import { openCreateIssue } from '@/lib/issue-events'
import { formatDateTime } from '@/lib/relative-time'
import type { Issue, IssueActivity, UpdateIssueData } from '@/types/issue'

/** The issue page: `/$workspaceKey/issue/ENG-12` (ISS-2, ISS-6..ISS-12). */
export const Route = createFileRoute('/_authed/$workspaceKey/issue/$identifier')({
  component: IssuePage,
})

function IssuePage() {
  const { identifier } = Route.useParams()
  const { workspace, path } = useCurrentWorkspace()
  const issueQuery = useIssueByIdentifier(workspace.id, identifier)
  // The description editor starts from the issue fetched after the page opened, and
  // after a save still in flight from the last visit: a cached copy can be out of date.
  const saving =
    useIsMutating({ mutationKey: issueUpdateMutationKey(issueQuery.data?.id ?? '') }) > 0
  const readyKey = `${workspace.id}/${identifier.toUpperCase()}`
  const [readyFor, setReadyFor] = React.useState<string | null>(null)
  if (readyFor !== readyKey && issueQuery.isFetchedAfterMount && !saving) setReadyFor(readyKey)

  if (issueQuery.isError) {
    return (
      <>
        <PageHeader title={identifier.toUpperCase()} />
        <EmptyState
          icon={<SearchX />}
          title="Issue not found"
          description={`${identifier.toUpperCase()} does not exist in this workspace or was deleted.`}
          action={
            <Link to={path('/my-issues') as '/'} className="text-ui text-primary hover:underline">
              Go to my issues
            </Link>
          }
        />
      </>
    )
  }

  if (!issueQuery.data || readyFor !== readyKey) {
    return (
      <>
        <PageHeader title={identifier.toUpperCase()} />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10" aria-busy="true">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </>
    )
  }

  // A new component per issue: the drafts (title, description) belong to one issue.
  return <IssueDetail key={issueQuery.data.id} issue={issueQuery.data} />
}

/** Display name of the issue's project / cycle, from the newest history row of that field. */
function lastValue(activity: IssueActivity[] | undefined, field: string): string | null {
  const rows = activity?.filter(a => a.field === field) ?? []
  return rows.at(-1)?.to_value ?? null
}

function IssueDetail({ issue }: { issue: Issue }) {
  const { workspace, members, labels, me, path } = useCurrentWorkspace()
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const issuePath = React.useCallback((identifier: string) => path(`/issue/${identifier}`), [path])

  const statesQuery = useTeamStates(issue.team_id)
  const cyclesQuery = useTeamCycles(issue.team_id)
  const projectsQuery = useProjects(workspace.id)
  const parentQuery = useIssue(issue.parent_id)
  const subIssuesQuery = useSubIssues(issue.id)
  const relationsQuery = useRelations(issue.id)
  const activityQuery = useIssueActivity(issue.id)
  const commentsQuery = useComments(issue.id)
  const subscribersQuery = useSubscribers(issue.id)

  const updateIssue = useUpdateIssueDetail(issue)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  // Leave the page before the caches change, or it fetches the deleted issue (404s).
  const deleteIssue = useDeleteIssueDetail(issue, async () => {
    setDeleteOpen(false)
    toast.success(`Deleted ${issue.identifier}`)
    await navigate({ to: path(`/team/${issue.team.key}/issues`) as '/' })
  })
  const createSubIssue = useCreateSubIssue()
  const createRelation = useCreateRelation(issue.id)
  const deleteRelation = useDeleteRelation()
  const createComment = useCreateComment(issue.id)
  const updateComment = useUpdateComment(issue.id)
  const deleteComment = useDeleteComment(issue.id)
  const toggleSubscription = useToggleSubscription(issue.id)

  const [relationSearch, setRelationSearch] = React.useState('')
  const debouncedSearch = useDebounce(relationSearch, 200)
  const searchQuery = useIssueSearch(workspace.id, debouncedSearch)
  const [openPicker, setOpenPicker] = React.useState<PanelPicker | null>(null)
  const titleRef = React.useRef<HTMLTextAreaElement>(null)

  const update = (data: UpdateIssueData) =>
    updateIssue.mutate(
      { data },
      { onError: error => toastApiError(error, 'Could not update issue') }
    )

  // Description: local draft, saved 800ms after the last keystroke.
  const [description, setDescription] = React.useState(issue.description ?? '')
  const autosave = useDebouncedAutosave(description, (next, { keepalive }) =>
    updateIssue.mutateAsync({ data: { description: next || null }, keepalive }).catch(error => {
      toastApiError(error, 'Could not save description')
      throw error
    })
  )

  const renderIssueHref = useIssueHref()
  const onIssueClick = (identifier: string, event: IssueLinkClick) => {
    if (event.metaKey || event.ctrlKey) return
    event.preventDefault()
    void navigate({ to: issuePath(identifier) as '/' })
  }

  const subscribed = subscribersQuery.data?.some(user => user.id === me.id) ?? false
  const toggleSubscribe = () =>
    toggleSubscription.mutate(!subscribed, {
      onSuccess: () =>
        toast.success(subscribed ? 'Unsubscribed from issue' : 'Subscribed to issue'),
      onError: error => toastApiError(error, 'Could not change subscription'),
    })

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Copied ${what} to clipboard`)
    } catch (error) {
      toastApiError(error, `Could not copy ${what}`)
    }
  }
  const copyLink = () => copy(`${window.location.origin}${issuePath(issue.identifier)}`, 'link')
  const copyId = () => copy(issue.identifier, 'ID')

  const archived = issue.archived_at !== null
  const setArchived = (value: boolean) =>
    updateIssue.mutate(
      { data: { archived: value } },
      {
        onSuccess: () => toast.success(value ? `${issue.identifier} archived` : 'Issue restored'),
        onError: error => toastApiError(error, 'Could not archive issue'),
      }
    )

  const confirmDelete = () =>
    deleteIssue.mutate(undefined, {
      onError: error => toastApiError(error, 'Could not delete issue'),
    })

  // Linear's issue shortcuts (ignored while typing in a field).
  // The picker opens after the key event, so the key is not typed into its search box.
  const openPickerSoon = (picker: PanelPicker) => window.setTimeout(() => setOpenPicker(picker), 0)
  useShortcut('s', () => openPickerSoon('status'))
  useShortcut('p', () => openPickerSoon('priority'))
  useShortcut('a', () => openPickerSoon('assignee'))
  useShortcut('l', () => openPickerSoon('labels'))
  useShortcut('i', () => {
    if (issue.assignee_id !== me.id) update({ assignee_id: me.id })
  })
  useShortcut('r', () => titleRef.current?.focus())
  useShortcut('shift+s', toggleSubscribe, { enabled: !!subscribersQuery.data })
  useShortcut('mod+.', () => void copyId())
  useShortcut('mod+backspace', () => setDeleteOpen(true))
  // Esc goes back to where the issue was opened from (the team list on a direct link).
  // Open pickers, dialogs and fields handle Esc themselves first.
  useShortcut('esc', () => {
    if (canGoBack) router.history.back()
    else void navigate({ to: path(`/team/${issue.team.key}/issues`) as '/' })
  })

  const parent = parentQuery.data
  const currentProject = projectsQuery.data?.find(project => project.id === issue.project_id)
  const projectName = !issue.project_id
    ? null
    : (currentProject?.name ?? lastValue(activityQuery.data, 'project') ?? 'Project')
  const currentCycle = cyclesQuery.data?.find(cycle => cycle.id === issue.cycle_id)
  const cycleName = !issue.cycle_id
    ? null
    : currentCycle
      ? cycleLabel(currentCycle)
      : (lastValue(activityQuery.data, 'cycle') ?? 'Cycle')
  const breadcrumbs = [
    { label: issue.team.name, to: path(`/team/${issue.team.key}/issues`) },
    ...(parent ? [{ label: parent.identifier, to: issuePath(parent.identifier) }] : []),
  ]

  const actions = (
    <>
      <FavoriteButton entityType="issue" entityId={issue.id} />
      <IconButton
        label={subscribed ? 'Unsubscribe' : 'Subscribe'}
        shortcut="Shift S"
        icon={subscribed ? <BellOff /> : <Bell />}
        onClick={toggleSubscribe}
        disabled={!subscribersQuery.data || toggleSubscription.isPending}
      />
      <IconButton label="Copy issue URL" icon={<LinkIcon />} onClick={() => void copyLink()} />
      <IconButton
        label="Copy issue ID"
        icon={<Hash />}
        shortcut="⌘ ."
        onClick={() => void copyId()}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="Issue actions" icon={<MoreHorizontal />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          // Keep the focus (and its tooltip) off the trigger: the archive banner opens under it.
          onCloseAutoFocus={event => event.preventDefault()}
        >
          {archived ? (
            <DropdownMenuItem onSelect={() => setArchived(false)}>
              <ArchiveRestore />
              Restore issue
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setArchived(true)}>
              <Archive />
              Archive issue
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 />
            Delete issue…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader breadcrumbs={breadcrumbs} title={issue.identifier} actions={actions} />

      {archived ? (
        <div
          role="status"
          className="flex h-10 items-center gap-2 border-b border-border-subtle bg-surface-hover/50 px-4 text-mini text-text-secondary"
        >
          <Archive className="size-3.5" />
          <span>
            This issue was archived {issue.archived_at ? formatDateTime(issue.archived_at) : ''}.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setArchived(false)}
          >
            Restore
          </Button>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 lg:px-10">
            <div className="flex flex-col gap-3">
              {parent ? (
                <Link
                  to={issuePath(parent.identifier) as '/'}
                  className="flex w-fit max-w-full items-center gap-1.5 text-mini whitespace-nowrap text-text-secondary hover:text-foreground"
                >
                  <CornerLeftUp className="size-3.5 shrink-0" />
                  <span className="shrink-0">Sub-issue of</span>
                  <StatusIcon type={parent.state.type} color={parent.state.color} size={12} />
                  <span className="shrink-0 text-text-tertiary">{parent.identifier}</span>
                  <span className="max-w-xs min-w-0 truncate text-foreground">{parent.title}</span>
                </Link>
              ) : null}
              <IssueTitleInput
                ref={titleRef}
                value={issue.title}
                onSave={title => update({ title })}
              />
              <div className="relative">
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  onBlur={() => autosave.flush()}
                  placeholder="Add description…"
                  ariaLabel="Issue description"
                  renderIssueHref={renderIssueHref}
                  onIssueClick={onIssueClick}
                  className="min-h-16"
                />
                <span
                  aria-live="polite"
                  className="absolute -bottom-5 right-0 text-micro text-text-tertiary"
                >
                  {autosave.status === 'saving'
                    ? 'Saving…'
                    : autosave.status === 'error'
                      ? 'Not saved'
                      : ''}
                </span>
              </div>
            </div>

            <SubIssuesSection
              subIssues={subIssuesQuery.data}
              issuePath={issuePath}
              creating={createSubIssue.isPending}
              onOpenFullForm={() =>
                openCreateIssue({
                  teamId: issue.team_id,
                  parentId: issue.id,
                  projectId: issue.project_id ?? undefined,
                  cycleId: issue.cycle_id ?? undefined,
                })
              }
              onCreate={title =>
                // Like the full form: the sub-issue starts in the parent's project and cycle.
                createSubIssue
                  .mutateAsync({
                    team_id: issue.team_id,
                    title,
                    parent_id: issue.id,
                    project_id: issue.project_id,
                    cycle_id: issue.cycle_id,
                  })
                  .catch(error => {
                    toastApiError(error, 'Could not create sub-issue')
                    throw error
                  })
              }
            />

            <RelationsSection
              relations={relationsQuery.data ?? []}
              excludeIds={[issue.id]}
              issuePath={issuePath}
              search={relationSearch}
              onSearchChange={setRelationSearch}
              searchResults={searchQuery.data?.items ?? []}
              searching={searchQuery.isFetching}
              onAdd={(type, other) =>
                createRelation.mutate(
                  { related_issue_id: other.id, type },
                  { onError: error => toastApiError(error, 'Could not add relation') }
                )
              }
              onRemove={relation =>
                deleteRelation.mutate(relation.id, {
                  onError: error => toastApiError(error, 'Could not remove relation'),
                })
              }
            />

            <section
              aria-labelledby="activity-heading"
              className="flex flex-col gap-3 border-t border-border-subtle pt-6"
            >
              <div className="flex items-center gap-2">
                <h2 id="activity-heading" className="text-ui font-medium text-foreground">
                  Activity
                </h2>
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex -space-x-1" aria-label="Subscribers">
                    {(subscribersQuery.data ?? []).slice(0, 5).map(user => (
                      <Tooltip key={user.id}>
                        <TooltipTrigger asChild>
                          <span className="rounded-full ring-2 ring-surface">
                            <UserAvatar name={user.name || user.email} size="xs" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{user.name || user.email}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSubscribe}
                    disabled={!subscribersQuery.data || toggleSubscription.isPending}
                  >
                    {subscribed ? 'Unsubscribe' : 'Subscribe'}
                  </Button>
                </div>
              </div>
              <IssueTimeline
                activity={activityQuery.data ?? []}
                comments={commentsQuery.data ?? []}
                meId={me.id}
                renderIssueHref={renderIssueHref}
                onIssueClick={onIssueClick}
                onEditComment={(comment, body) =>
                  updateComment
                    .mutateAsync({ commentId: comment.id, data: { body } })
                    .catch(error => {
                      toastApiError(error, 'Could not edit comment')
                      throw error
                    })
                }
                onDeleteComment={comment =>
                  deleteComment.mutate(comment.id, {
                    onError: error => toastApiError(error, 'Could not delete comment'),
                  })
                }
              />
              <CommentComposer
                submitting={createComment.isPending}
                renderIssueHref={renderIssueHref}
                onIssueClick={onIssueClick}
                onSubmit={body =>
                  createComment.mutateAsync({ body }).catch(error => {
                    toastApiError(error, 'Could not add comment')
                    throw error
                  })
                }
              />
            </section>
          </div>
        </div>

        <div className="order-first border-b border-border-subtle px-4 py-4 lg:order-none lg:w-[280px] lg:shrink-0 lg:border-b-0 lg:border-l">
          <IssuePropertiesPanel
            issue={issue}
            states={statesQuery.data ?? []}
            members={members}
            labels={labels}
            projectName={projectName}
            projects={projectsQuery.data}
            cycleName={cycleName}
            cycles={cyclesQuery.data}
            openPicker={openPicker}
            onOpenPickerChange={setOpenPicker}
            onUpdate={update}
          />
        </div>
      </div>

      <DeleteIssueDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        identifier={issue.identifier}
        pending={deleteIssue.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
