import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Archive, CircleDot, Layers, SignalHigh, Tag, Trash2, UserRound } from 'lucide-react'
import { useShortcutSequencePending } from '@/components/command'
import { BulkActionBar, GroupedList, KanbanBoard, type MoveEvent } from '@/components/board'
import { EmptyState } from '@/components/EmptyState'
import { PropertyPicker, type PropertyOption } from '@/components/PropertyPicker'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import {
  activeFilterCount,
  readViewState,
  viewParams,
  viewStateToSearch,
  type FilterKind,
  type IssueGrouping,
  type IssueLayout,
  type IssueViewState,
} from '@/features/issues/view-state'
import { useIssueActions, type IssueChanges } from '@/hooks/useIssueActions'
import { useCycleRefs, useProjectRefs } from '@/hooks/useIssueRefs'
import { useIssueList } from '@/hooks/useIssues'
import { openCreateIssue } from '@/lib/issue-events'
import type { CreateIssueEventDetail, Issue, IssuePriority, IssuesParams } from '@/types/issue'
import { DeleteIssuesDialog } from './DeleteIssuesDialog'
import { groupIssues, sortOrderBetween, statusKey } from './issue-groups'
import {
  assigneeOptions,
  cycleOptions,
  labelOptions,
  NONE,
  priorityOptions,
  projectOptions,
  statusOptions,
} from './issue-options'
import { IssueViewContext, type IssueViewContextValue, type OpenPicker } from './IssuePickers'
import { IssueCard, IssueRow } from './IssueRow'
import { IssueToolbar } from './IssueToolbar'

export interface IssuesViewProps {
  /** The page's base query (workspace_id plus e.g. team_id, assignee_id=me, state_type__in). */
  params: IssuesParams
  defaultLayout?: IssueLayout
  /** Default grouping. */
  groupBy?: IssueGrouping
  /** Shown when the view has no issues and no filter is active. */
  emptyState?: ReactNode
  /** Defaults of the create-issue modal opened from this view (group "+" buttons). */
  createDefaults?: CreateIssueEventDetail
  /** Filter kinds not offered in the filter menu. */
  hiddenFilters?: FilterKind[]
  /** Extra buttons on the right of the toolbar. */
  toolbarActions?: ReactNode
}

const PICKER_KEYS: Record<string, OpenPicker['kind']> = {
  s: 'status',
  p: 'priority',
  a: 'assignee',
  l: 'labels',
}

/**
 * The shared issue list / board (ISS-3, ISS-4, ISS-5, ISS-14): grouped list or
 * Kanban board, filters, search, display options (all kept in the URL),
 * inline property pickers, context menu, multi-select with bulk actions and
 * keyboard navigation (J/K/Enter, S/P/A/L open pickers, X selects,
 * Cmd+Backspace deletes).
 */
export function IssuesView({
  params,
  defaultLayout = 'list',
  groupBy = 'status',
  emptyState,
  createDefaults,
  hiddenFilters = [],
  toolbarActions,
}: IssuesViewProps) {
  const ws = useCurrentWorkspace()
  const navigate = useNavigate()
  const search = useRouterState({ select: s => s.location.search }) as Record<string, unknown>
  const defaults = useMemo(
    () => ({ layout: defaultLayout, grouping: groupBy }),
    [defaultLayout, groupBy]
  )
  // Filters hidden on this page (its base params already set them) never
  // apply, even when the URL carries them (a shared link, another tab).
  const urlState = readViewState(search, defaults)
  const state: IssueViewState = {
    ...urlState,
    filters: Object.fromEntries(
      Object.entries(urlState.filters).map(([kind, values]) => [
        kind,
        hiddenFilters.includes(kind as FilterKind) ? [] : values,
      ])
    ) as IssueViewState['filters'],
  }
  const defaultState = useMemo(() => readViewState({}, defaults), [defaults])

  const setViewState = (next: IssueViewState) => {
    void navigate({
      to: '.',
      replace: true,
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        ...viewStateToSearch(next, defaults),
      })) as never,
    })
  }

  const queryParams = viewParams(params, state)
  const query = useIssueList(queryParams)
  const issues = useMemo(() => query.data ?? [], [query.data])
  const actions = useIssueActions()
  const sequencePending = useShortcutSequencePending()

  const scopeTeams = params.team_id ? ws.teams.filter(t => t.id === params.team_id) : ws.teams
  const scopeTeamIds = scopeTeams.map(t => t.id)
  const scopeStates = actions.states.filter(s => scopeTeamIds.includes(s.team_id))
  const projects = useProjectRefs(ws.workspace.id)
  const cycles = useCycleRefs(scopeTeamIds)

  const grouped = groupIssues({
    issues,
    grouping: state.grouping,
    ordering: state.ordering,
    states: scopeStates,
    stateTypes: queryParams.state_type__in,
    members: ws.members,
    projects,
    meId: ws.me.id,
    keepEmpty: state.layout === 'board',
  })

  // --- selection, pickers, delete ----------------------------------------------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [openPicker, setOpenPicker] = useState<OpenPicker | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<Issue[]>([])
  const byId = useMemo(() => new Map(issues.map(i => [i.id, i])), [issues])
  const selected = issues.filter(i => selectedIds.has(i.id))

  const clearSelection = () => setSelectedIds(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const listbox = () => containerRef.current?.querySelector<HTMLElement>('[role="listbox"]')
  // A row picker, the context menu or the delete dialog closed: focus goes back
  // to the list so J/K/S/P/A keep working (not to the row's trigger button,
  // which can also be gone when the issue moved to another group or was deleted).
  const onPickerCloseAutoFocus = (event: Event) => {
    const list = listbox()
    if (!list) return
    event.preventDefault()
    list.focus({ preventScroll: true })
  }

  const context: IssueViewContextValue = {
    teams: ws.teams,
    states: actions.states,
    members: ws.members,
    labels: ws.labels,
    projects,
    meId: ws.me.id,
    actions,
    openPicker,
    setOpenPicker,
    onPickerCloseAutoFocus,
    targetsFor: issue => (selectedIds.has(issue.id) && selected.length > 1 ? selected : [issue]),
    confirmDelete: setDeleteTargets,
    path: ws.path,
  }

  const openIssue = (issue: Issue) => {
    void navigate({ to: ws.path(`/issue/${issue.identifier}`) as '/' })
  }

  // --- moves (board drag, list reorder) ----------------------------------------
  const handleMove = (event: MoveEvent) => {
    const issue = byId.get(event.itemId)
    if (!issue) return
    const changes: IssueChanges = {}
    if (state.ordering === 'manual') {
      const before = event.beforeId ? byId.get(event.beforeId) : undefined
      const after = event.afterId ? byId.get(event.afterId) : undefined
      const others = issues.filter(i => i.id !== issue.id)
      const sortOrder = sortOrderBetween(before, after, others)
      if (sortOrder !== undefined) changes.sort_order = sortOrder
    }
    if (event.fromColumnId !== event.toColumnId) {
      const column = event.toColumnId
      if (state.grouping === 'status') {
        const target =
          actions.states.find(s => s.team_id === issue.team_id && statusKey(s) === column) ??
          actions.states.find(s => s.team_id === issue.team_id && s.type === column.split(':')[0])
        if (!target) return
        actions.setState([issue], target.id, changes)
        return
      }
      if (state.grouping === 'priority') changes.priority = Number(column) as IssuePriority
      if (state.grouping === 'assignee') changes.assignee_id = column === NONE ? null : column
      if (state.grouping === 'project') changes.project_id = column === NONE ? null : column
    }
    if (Object.keys(changes).length > 0) actions.apply([issue], changes, 'Could not move issue')
  }

  const addInGroup = (groupId: string) => {
    const detail: CreateIssueEventDetail = { ...createDefaults }
    if (!detail.teamId && params.team_id) detail.teamId = params.team_id
    if (state.grouping === 'status') {
      // Without a page team (My issues), the user's own team, as the modal's default.
      const teamId =
        detail.teamId ?? ws.myTeams.find(t => scopeTeamIds.includes(t.id))?.id ?? scopeTeamIds[0]
      const target = actions.states.find(s => s.team_id === teamId && statusKey(s) === groupId)
      if (target) {
        detail.teamId = teamId
        detail.stateId = target.id
      }
    }
    if (state.grouping === 'priority') detail.priority = Number(groupId) as IssuePriority
    // "No assignee" / "No project" also drop the page default (My issues > Assigned
    // assigns to me, a project page sets its project).
    if (state.grouping === 'assignee') detail.assigneeId = groupId === NONE ? undefined : groupId
    if (state.grouping === 'project') detail.projectId = groupId === NONE ? undefined : groupId
    openCreateIssue(detail)
  }

  // --- keyboard: S / P / A / L open pickers, Cmd+Backspace deletes -------------
  const focusedIssue = (): Issue | undefined => {
    const domId = listbox()?.getAttribute('aria-activedescendant')
    return domId ? byId.get(domId.slice(-36)) : undefined
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.getAttribute('role') !== 'listbox') return
    const issue = focusedIssue()
    if ((event.metaKey || event.ctrlKey) && (event.key === 'Backspace' || event.key === 'Delete')) {
      const targets = selected.length > 0 ? selected : issue ? [issue] : []
      if (targets.length > 0) {
        event.preventDefault()
        setDeleteTargets(targets)
      }
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    // "g p" / "g s": the key completes a global navigation shortcut, not a picker.
    if (sequencePending()) return
    const kind = PICKER_KEYS[event.key.toLowerCase()]
    if (kind && issue) {
      event.preventDefault()
      setOpenPicker({ issueId: issue.id, kind })
    }
  }

  // Focus the list on load so J/K work at once (unless something else has focus).
  const loaded = !query.isLoading
  useEffect(() => {
    if (!loaded || state.layout !== 'list') return
    if (document.activeElement && document.activeElement !== document.body) return
    containerRef.current
      ?.querySelector<HTMLElement>('[role="listbox"]')
      ?.focus({ preventScroll: true })
  }, [loaded, state.layout])

  // --- filter options -----------------------------------------------------------
  const people = assigneeOptions(ws.members, { meId: ws.me.id })
  const allFilterOptions: Record<FilterKind, PropertyOption[]> = {
    status: statusOptions(scopeStates, scopeTeams),
    priority: priorityOptions(),
    assignee: people,
    creator: people.filter(option => option.value !== NONE),
    label: labelOptions(ws.labels),
    project: projects.length ? projectOptions(projects) : [],
    cycle: cycles.length ? cycleOptions(cycles) : [],
  }
  // Multi-select filters: no single-key shortcuts (they would pick while typing).
  const filterOptions = Object.fromEntries(
    Object.entries(allFilterOptions).map(([kind, options]) => [
      kind,
      hiddenFilters.includes(kind as FilterKind)
        ? []
        : options.map(option => ({ ...option, shortcut: undefined })),
    ])
  ) as Record<FilterKind, PropertyOption[]>

  const filtered = activeFilterCount(state) > 0 || state.search.trim() !== ''

  let body: ReactNode
  if (query.isLoading) {
    body = (
      <div aria-busy="true" aria-label="Loading issues" className="flex flex-col">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex h-9 items-center gap-3 border-b border-border-subtle px-4">
            <Skeleton className="size-3.5" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="size-5 rounded-full" />
          </div>
        ))}
      </div>
    )
  } else if (query.isError) {
    body = (
      <EmptyState
        title="Could not load issues"
        description={query.error.message}
        action={
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    )
  } else if (issues.length === 0 && state.layout === 'list') {
    body = filtered ? (
      <EmptyState
        icon={<Layers />}
        title="No issues match"
        description="No issue matches the filters and search of this view."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewState({ ...state, filters: defaultState.filters, search: '' })}
          >
            Clear filters
          </Button>
        }
      />
    ) : (
      (emptyState ?? (
        <EmptyState
          icon={<Layers />}
          title="No issues"
          description="Issues you create show up here."
          action={
            <Button
              size="sm"
              onClick={() =>
                openCreateIssue({
                  ...createDefaults,
                  teamId: createDefaults?.teamId ?? params.team_id,
                })
              }
            >
              Create issue
            </Button>
          }
        />
      ))
    )
  } else if (state.layout === 'board') {
    body = (
      <KanbanBoard
        className="h-full min-h-0 flex-1 px-3 pt-2"
        aria-label="Issue board"
        columns={grouped.groups}
        items={grouped.items}
        getItemId={issue => issue.id}
        renderCard={(issue, { isOverlay }) =>
          isOverlay ? (
            <div className="rounded-md border border-border bg-surface p-3 text-ui shadow-popover">
              <div className="text-mini text-text-tertiary">{issue.identifier}</div>
              <div className="mt-1 line-clamp-2">{issue.title}</div>
            </div>
          ) : (
            <IssueCard issue={issue} onOpen={openIssue} />
          )
        }
        onMove={handleMove}
        onAddInColumn={addInGroup}
        onOpen={openIssue}
      />
    )
  } else {
    body = (
      <GroupedList
        className="min-h-0 flex-1 bg-surface"
        aria-label="Issues"
        groups={grouped.groups}
        items={grouped.items}
        getItemId={issue => issue.id}
        renderRow={issue => <IssueRow issue={issue} />}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpen={openIssue}
        onAddInGroup={addInGroup}
        onMove={state.ordering === 'manual' ? handleMove : undefined}
        rowHeight={40}
      />
    )
  }

  const bulkStates = selected.length
    ? actions.states.filter(s => s.team_id === selected[0].team_id)
    : []

  return (
    <IssueViewContext.Provider value={context}>
      {/* Keyboard shortcuts of the focused row bubble up from the listbox. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
        <IssueToolbar
          state={state}
          onChange={next => {
            clearSelection()
            setViewState(next)
          }}
          filterOptions={filterOptions}
          defaults={defaultState}
          actions={toolbarActions}
        />
        {body}
        <BulkActionBar
          count={selected.length}
          onClear={clearSelection}
          label={selected.length === 1 ? 'issue selected' : 'issues selected'}
        >
          <PropertyPicker
            label="Status"
            placeholder="Change status..."
            side="top"
            onCloseAutoFocus={onPickerCloseAutoFocus}
            options={statusOptions(bulkStates)}
            value={null}
            onChange={stateId => actions.setState(selected, stateId)}
            trigger={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <CircleDot className="size-3.5" />
                Status
              </Button>
            }
          />
          <PropertyPicker
            label="Priority"
            placeholder="Set priority to..."
            side="top"
            onCloseAutoFocus={onPickerCloseAutoFocus}
            options={priorityOptions()}
            value={null}
            onChange={value => actions.setPriority(selected, Number(value) as IssuePriority)}
            trigger={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <SignalHigh className="size-3.5" />
                Priority
              </Button>
            }
          />
          <PropertyPicker
            label="Assignee"
            placeholder="Assign to..."
            side="top"
            onCloseAutoFocus={onPickerCloseAutoFocus}
            options={assigneeOptions(ws.members, { meId: ws.me.id })}
            value={null}
            onChange={value => actions.setAssignee(selected, value === NONE ? null : value)}
            trigger={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <UserRound className="size-3.5" />
                Assignee
              </Button>
            }
          />
          <PropertyPicker
            label="Add label"
            placeholder="Add label..."
            side="top"
            onCloseAutoFocus={onPickerCloseAutoFocus}
            options={labelOptions(ws.labels)}
            value={null}
            onChange={labelId => actions.addLabels(selected, [labelId])}
            trigger={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <Tag className="size-3.5" />
                Label
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => {
              actions.archiveIssues(selected)
              clearSelection()
              // The bar (and this button) goes away: keep J/K working on the list.
              listbox()?.focus({ preventScroll: true })
            }}
          >
            <Archive className="size-3.5" />
            Archive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setDeleteTargets(selected)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </BulkActionBar>
        <DeleteIssuesDialog
          issues={deleteTargets}
          pending={actions.isDeleting}
          onCloseAutoFocus={onPickerCloseAutoFocus}
          onCancel={() => setDeleteTargets([])}
          onConfirm={() =>
            actions.deleteIssues(deleteTargets, () => {
              setDeleteTargets([])
              clearSelection()
            })
          }
        />
      </div>
    </IssueViewContext.Provider>
  )
}
