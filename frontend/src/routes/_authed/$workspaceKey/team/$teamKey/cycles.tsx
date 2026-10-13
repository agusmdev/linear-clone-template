import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { IterationCcw, Plus } from 'lucide-react'
import { CycleActionsMenu } from '@/components/CycleActionsMenu'
import { CycleFormDialog } from '@/components/CycleFormDialog'
import { CycleIcon, CycleProgressBar, CycleScopeCounts } from '@/components/CycleProgress'
import { DeleteCycleDialog } from '@/components/DeleteCycleDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { cycleFormToPayload, type CycleFormData } from '@/features/cycles/cycle-schemas'
import { cycleTiming, cycleTitle, formatRange, nextCycleDates } from '@/features/cycles/cycle-dates'
import { useCreateCycle, useDeleteCycle, useTeamCycles, useUpdateCycle } from '@/hooks/useCycles'
import { toastApiError } from '@/lib/error-handler'
import type { Cycle, CycleStatus } from '@/types/cycle'

/** CYC-1: the cycles of a team, in Current / Upcoming / Past sections. */
export const Route = createFileRoute('/_authed/$workspaceKey/team/$teamKey/cycles')({
  component: TeamCyclesPage,
})

const SECTIONS: { status: CycleStatus; title: string }[] = [
  { status: 'current', title: 'Current' },
  { status: 'upcoming', title: 'Upcoming' },
  { status: 'past', title: 'Past' },
]

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; cycle: Cycle }
  | { kind: 'delete'; cycle: Cycle }
  | null

function TeamCyclesPage() {
  const { teamKey } = Route.useParams()
  const { teams, path } = useCurrentWorkspace()
  const team = teams.find(t => t.key === teamKey.toUpperCase())
  const cyclesQuery = useTeamCycles(team?.id)
  const createCycle = useCreateCycle(team?.id ?? '')
  const updateCycle = useUpdateCycle()
  const deleteCycle = useDeleteCycle()
  const [dialog, setDialog] = useState<DialogState>(null)

  const cycles = useMemo(() => cyclesQuery.data ?? [], [cyclesQuery.data])
  const grouped = useMemo(() => {
    const byStatus: Record<CycleStatus, Cycle[]> = { current: [], upcoming: [], past: [] }
    for (const cycle of cycles) byStatus[cycle.status].push(cycle)
    // Most recent past cycle first, like Linear.
    byStatus.past.reverse()
    return byStatus
  }, [cycles])

  if (!team) {
    return (
      <>
        <PageHeader title="Cycles" />
        <EmptyState
          title="Team not found"
          description={`There is no team with the key ${teamKey} in this workspace.`}
        />
      </>
    )
  }

  const nextNumber = cycles.reduce((max, c) => Math.max(max, c.number), 0) + 1
  const openCreate = () => setDialog({ kind: 'create' })

  const createDefaults: CycleFormData = { name: '', ...nextCycleDates(cycles) }
  const formDefaults: CycleFormData =
    dialog?.kind === 'edit'
      ? {
          name: dialog.cycle.name ?? '',
          starts_at: dialog.cycle.starts_at,
          ends_at: dialog.cycle.ends_at,
        }
      : createDefaults

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: team.name, to: path(`/team/${team.key}/issues`) }]}
        title="Cycles"
        actions={
          // The create defaults start after the last cycle: wait for the list.
          <Button size="sm" onClick={openCreate} disabled={cyclesQuery.isPending}>
            <Plus />
            New cycle
          </Button>
        }
      />

      {cyclesQuery.isPending ? (
        <div className="flex flex-col" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex h-11 items-center gap-3 border-b border-border-subtle px-4"
            >
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="ml-auto h-1.5 w-32" />
            </div>
          ))}
        </div>
      ) : cyclesQuery.isError ? (
        <EmptyState
          title="Could not load cycles"
          description={cyclesQuery.error.message}
          action={
            <Button size="sm" variant="outline" onClick={() => cyclesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : cycles.length === 0 ? (
        <EmptyState
          icon={<IterationCcw />}
          title="No cycles"
          description="Cycles help your team work in focused periods."
          action={
            <Button size="sm" onClick={openCreate}>
              Create cycle
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col">
          {SECTIONS.filter(section => grouped[section.status].length > 0).map(section => (
            <section key={section.status} aria-labelledby={`cycles-${section.status}`}>
              <h2
                id={`cycles-${section.status}`}
                className="flex h-9 items-center gap-2 border-b border-border-subtle bg-surface-hover/50 px-4 text-ui font-medium text-foreground"
              >
                {section.title}
                <span className="text-text-tertiary tabular-nums">
                  {grouped[section.status].length}
                </span>
              </h2>
              <ul>
                {grouped[section.status].map(cycle => (
                  <CycleRow
                    key={cycle.id}
                    cycle={cycle}
                    to={path(`/team/${team.key}/cycle/${cycle.id}`)}
                    onEdit={() => setDialog({ kind: 'edit', cycle })}
                    onDelete={() => setDialog({ kind: 'delete', cycle })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <CycleFormDialog
        mode={dialog?.kind === 'edit' ? 'edit' : 'create'}
        open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
        onOpenChange={open => {
          if (!open) setDialog(null)
        }}
        defaultValues={formDefaults}
        numberLabel={
          dialog?.kind === 'edit' ? `Cycle ${dialog.cycle.number}` : `Cycle ${nextNumber}`
        }
        isPending={createCycle.isPending || updateCycle.isPending}
        onSubmit={async data => {
          const payload = cycleFormToPayload(data)
          if (dialog?.kind === 'edit') {
            await updateCycle.mutateAsync({ cycleId: dialog.cycle.id, data: payload })
          } else {
            await createCycle.mutateAsync(payload)
          }
        }}
      />

      <DeleteCycleDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={open => {
          if (!open) setDialog(null)
        }}
        title={dialog?.kind === 'delete' ? cycleTitle(dialog.cycle) : ''}
        isPending={deleteCycle.isPending}
        onConfirm={() => {
          if (dialog?.kind !== 'delete') return
          deleteCycle.mutate(dialog.cycle.id, {
            onSuccess: () => setDialog(null),
            onError: error => toastApiError(error, 'Could not delete cycle'),
          })
        }}
      />
    </>
  )
}

function CycleRow({
  cycle,
  to,
  onEdit,
  onDelete,
}: {
  cycle: Cycle
  to: string
  onEdit: () => void
  onDelete: () => void
}) {
  const label = `Cycle ${cycle.number}`
  return (
    <li
      data-testid="cycle-row"
      className="group relative flex min-h-11 items-center gap-3 border-b border-border-subtle px-4 py-1.5 hover:bg-surface-hover"
    >
      <CycleIcon status={cycle.status} percentage={cycle.progress.percentage} />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <Link
          to={to as '/'}
          className="truncate text-ui font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none"
        >
          {label}
        </Link>
        {cycle.name ? (
          <span className="truncate text-ui text-text-secondary">{cycle.name}</span>
        ) : null}
        <span className="shrink-0 text-mini text-text-tertiary">
          {formatRange(cycle.starts_at, cycle.ends_at)}
        </span>
        <span className="hidden shrink-0 text-mini text-text-tertiary md:inline">
          · {cycleTiming(cycle)}
        </span>
      </div>
      <CycleScopeCounts progress={cycle.progress} className="hidden sm:flex" />
      <CycleProgressBar percentage={cycle.progress.percentage} className="w-28 shrink-0" />
      <CycleActionsMenu
        label={`${label} actions`}
        size="sm"
        className="relative z-10"
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </li>
  )
}
