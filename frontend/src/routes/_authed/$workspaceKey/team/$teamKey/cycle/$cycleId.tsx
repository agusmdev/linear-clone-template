import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { IterationCcw, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { CycleActionsMenu } from '@/components/CycleActionsMenu'
import { CycleFormDialog } from '@/components/CycleFormDialog'
import { CycleIcon, CycleProgressBar, CycleScopeBreakdown } from '@/components/CycleProgress'
import { CycleIssueList } from '@/components/CycleIssueList'
import { DeleteCycleDialog } from '@/components/DeleteCycleDialog'
import { EmptyState } from '@/components/EmptyState'
import { Kbd } from '@/components/Kbd'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { cycleTiming, cycleTitle, formatRange } from '@/features/cycles/cycle-dates'
import { cycleFormToPayload } from '@/features/cycles/cycle-schemas'
import {
  useCompleteCycle,
  useCycle,
  useCycleIssues,
  useDeleteCycle,
  useUpdateCycle,
} from '@/hooks/useCycles'
import { useTeamStates } from '@/hooks/useWorkspace'
import { toastApiError } from '@/lib/error-handler'
import { queryKeys } from '@/lib/query-keys'
import type { Cycle, CycleStatus } from '@/types/cycle'
import type { IssuesParams } from '@/types/issue'

/** CYC-1: one cycle — dates, progress, scope and its issues. */
export const Route = createFileRoute('/_authed/$workspaceKey/team/$teamKey/cycle/$cycleId')({
  component: CyclePage,
})

const STATUS_LABELS: Record<CycleStatus, string> = {
  current: 'Current',
  upcoming: 'Upcoming',
  past: 'Past',
}

function CyclePage() {
  const { teamKey, cycleId } = Route.useParams()
  const { teams, workspace, path } = useCurrentWorkspace()
  const team = teams.find(t => t.key === teamKey.toUpperCase())
  const cycleQuery = useCycle(cycleId)
  const cycle = cycleQuery.data

  const cyclesPath = path(`/team/${team?.key ?? teamKey}/cycles`)
  const breadcrumbs = [
    ...(team ? [{ label: team.name, to: path(`/team/${team.key}/issues`) }] : []),
    { label: 'Cycles', to: cyclesPath },
  ]

  if (cycleQuery.isError || (cycle && team && cycle.team_id !== team.id)) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="Cycle not found" />
        <EmptyState
          icon={<IterationCcw />}
          title="Cycle not found"
          description="This cycle does not exist or was deleted."
          action={
            <Link
              to={cyclesPath as '/'}
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              Back to cycles
            </Link>
          }
        />
      </>
    )
  }

  if (!cycle || !team) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title={<Skeleton className="h-3 w-24" />} />
        <div className="flex flex-col gap-3 p-4" aria-busy="true">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </>
    )
  }

  return (
    <CycleDetail
      cycle={cycle}
      teamId={team.id}
      workspaceId={workspace.id}
      breadcrumbs={breadcrumbs}
      cyclesPath={cyclesPath}
      issuePath={identifier => path(`/issue/${identifier}`)}
    />
  )
}

function CycleDetail({
  cycle,
  teamId,
  workspaceId,
  breadcrumbs,
  cyclesPath,
  issuePath,
}: {
  cycle: Cycle
  teamId: string
  workspaceId: string
  breadcrumbs: { label: string; to: string }[]
  cyclesPath: string
  issuePath: (identifier: string) => string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const updateCycle = useUpdateCycle()
  const deleteCycle = useDeleteCycle()
  const completeCycle = useCompleteCycle()
  const statesQuery = useTeamStates(teamId)

  const params = useMemo<IssuesParams>(
    () => ({ workspace_id: workspaceId, cycle_id: cycle.id, size: 100, order_by: ['sort_order'] }),
    [workspaceId, cycle.id]
  )
  const issuesQuery = useCycleIssues(params)

  // The progress counts come from the server: refresh them whenever the issues change
  // (created from the modal, moved, completed elsewhere).
  const issuesUpdatedAt = issuesQuery.dataUpdatedAt
  useEffect(() => {
    if (issuesUpdatedAt) {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycles.detail(cycle.id) })
    }
  }, [issuesUpdatedAt, cycle.id, queryClient])

  const title = cycleTitle(cycle)
  const newIssue = () =>
    window.dispatchEvent(
      new CustomEvent('linear:create-issue', { detail: { teamId, cycleId: cycle.id } })
    )

  const moveUnfinished = () =>
    completeCycle.mutate(
      { cycleId: cycle.id },
      {
        onSuccess: result => {
          const target = cycleTitle(result.target_cycle)
          toast.success(
            result.moved === 0
              ? `No unfinished issues to move`
              : `Moved ${result.moved} ${result.moved === 1 ? 'issue' : 'issues'} to ${target}`
          )
        },
        onError: error => toastApiError(error, 'Could not move unfinished issues'),
      }
    )

  const issues = issuesQuery.data?.items ?? []

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        icon={<CycleIcon status={cycle.status} percentage={cycle.progress.percentage} />}
        title={title}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={newIssue}>
              <Plus />
              New issue
            </Button>
            <CycleActionsMenu
              label="Cycle actions"
              onEdit={() => setDialog('edit')}
              onDelete={() => setDialog('delete')}
              onComplete={moveUnfinished}
            />
          </>
        }
      />

      <section
        aria-label="Cycle summary"
        className="flex flex-col gap-4 border-b border-border-subtle px-4 py-4"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui">
          <Badge variant={cycle.status === 'current' ? 'default' : 'outline'}>
            {STATUS_LABELS[cycle.status]}
          </Badge>
          {cycle.name ? <span className="text-text-secondary">Cycle {cycle.number}</span> : null}
          <span className="text-text-secondary" data-testid="cycle-dates">
            {formatRange(cycle.starts_at, cycle.ends_at)}
          </span>
          <span className="text-mini text-text-tertiary">{cycleTiming(cycle)}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-mini text-text-secondary">
            <span>Progress</span>
            <span className="tabular-nums" data-testid="cycle-completed">
              {cycle.progress.completed} of {cycle.progress.total} completed
            </span>
          </div>
          <CycleProgressBar percentage={cycle.progress.percentage} />
        </div>
        <CycleScopeBreakdown progress={cycle.progress} />
      </section>

      {issuesQuery.isPending ? (
        <div className="flex flex-col" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="flex h-10 items-center gap-3 border-b border-border-subtle px-4"
            >
              <Skeleton className="size-3.5" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          title="No issues in this cycle"
          description="Add issues to the cycle to plan the work of this period."
          action={
            <Button size="sm" onClick={newIssue}>
              Create new issue
              <Kbd>C</Kbd>
            </Button>
          }
        />
      ) : (
        <CycleIssueList
          issues={issues}
          states={statesQuery.data ?? []}
          issueTo={issue => issuePath(issue.identifier)}
        />
      )}

      <CycleFormDialog
        mode="edit"
        open={dialog === 'edit'}
        onOpenChange={open => setDialog(open ? 'edit' : null)}
        defaultValues={{
          name: cycle.name ?? '',
          starts_at: cycle.starts_at,
          ends_at: cycle.ends_at,
        }}
        numberLabel={`Cycle ${cycle.number}`}
        isPending={updateCycle.isPending}
        onSubmit={async data => {
          await updateCycle.mutateAsync({ cycleId: cycle.id, data: cycleFormToPayload(data) })
        }}
      />

      <DeleteCycleDialog
        open={dialog === 'delete'}
        onOpenChange={open => setDialog(open ? 'delete' : null)}
        title={title}
        isPending={deleteCycle.isPending}
        onConfirm={() =>
          deleteCycle.mutate(cycle.id, {
            onSuccess: () => {
              setDialog(null)
              toast.success(`Deleted ${title}`)
              navigate({ to: cyclesPath as '/' })
            },
            onError: error => toastApiError(error, 'Could not delete cycle'),
          })
        }
      />
    </>
  )
}
